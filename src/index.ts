import express, { Request, Response } from "express";
import { Db, MongoClient } from "mongodb";
import {
  consumePaymentsFromQueueWithInterval,
  processPayment,
  stopPaymentConsumer,
  verifyServiceAvailabilityWithInterval,
} from "./paymentProcessor";
import { addProcessToQueue, closeRedisClient, getQueueLength } from "./paymentQueue";

const app = express();
const PORT = process.env["PORT"] || 3000;
export const INSTANCE_ID = process.env["INSTANCE_ID"] || "unknown";

// MongoDB connection
const mongoUri =
  process.env["MONGODB_URI"] ||
  "mongodb://localhost:27017/rinha?maxIdleTimeMS=30000&maxPoolSize=500&minPoolSize=50&maxConnecting=10&serverSelectionTimeoutMS=5000&socketTimeoutMS=45000&connectTimeoutMS=10000&retryWrites=true&w=majority";

// MongoDB client options for high performance
const mongoClientOptions = {
  maxPoolSize: 500, // Maximum number of connections in the pool
  minPoolSize: 50, // Minimum number of connections in the pool
  maxIdleTimeMS: 30000, // How long a connection can be idle before being closed
  maxConnecting: 10, // Maximum number of connections being established simultaneously
  serverSelectionTimeoutMS: 5000, // Timeout for server selection
  socketTimeoutMS: 45000, // Socket timeout for operations
  connectTimeoutMS: 10000, // Connection timeout
  retryWrites: true, // Enable retry for write operations
  retryReads: true, // Enable retry for read operations
  monitorCommands: false, // Disable command monitoring for performance
  directConnection: false, // Allow connection to replica set members
  heartbeatFrequencyMS: 10000, // Heartbeat frequency
  appName: "rinha-backend", // Application name for monitoring
};

export let db: Db;
export let client: MongoClient;

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Disable unnecessary middleware for performance
app.disable("x-powered-by");

export type PaymentRequest = {
  correlationId: string;
  amount: number;
};
app.post("/payments", async (req: Request, res: Response) => {
  try {
    const { correlationId, amount } = req.body;

    if (!correlationId || typeof amount !== "number") {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const paymentRequest = {
      correlationId,
      amount,
    };

    addProcessToQueue(paymentRequest);

    return res.status(202).json({ message: "Success", correlationId });
  } catch (error) {
    console.error("Error processing payment request:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/payments-summary", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const from = req.query["from"] ? new Date(req.query["from"] as string) : null;
    const to = req.query["to"] ? new Date(req.query["to"] as string) : null;

    const query: any = {};

    if (from || to) {
      query.requested_at = {};
      if (from) query.requested_at.$gte = from;
      if (to) query.requested_at.$lte = to;
    }

    const paymentsCollection = db.collection("payments").find(query);

    const result = {
      default: {
        totalRequests: 0,
        totalAmount: 0,
      },
      fallback: {
        totalRequests: 0,
        totalAmount: 0,
      },
    };

    let processedCount = 0;

    for await (const payment of paymentsCollection) {
      processedCount++;
      if (payment.service === "default") {
        if (payment.success === true) {
          result.default.totalAmount += payment.amount;
        }
        result.default.totalRequests++;
      } else {
        if (payment.success === true) {
          result.fallback.totalAmount += payment.amount;
        }
        result.fallback.totalRequests++;
      }
    }

    result.default.totalAmount = Math.round(result.default.totalAmount * 100) / 100;
    result.fallback.totalAmount = Math.round(result.fallback.totalAmount * 100) / 100;

    console.log(`✅ Payments summary completed in ${Date.now() - startTime}ms`);
    console.log(`⏳ Queue size: ${await getQueueLength()}`);

    res.status(200).json(result);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ Error getting payment summary after ${totalTime}ms:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/purge-payments", async (_req: Request, res: Response) => {
  try {
    const collection = db.collection("payments");
    await collection.deleteMany({});

    res.status(200).json({ message: "All payments purged." });
  } catch (error) {
    console.error("Error purging payments:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/health", async (_req: Request, res: Response) => {
  try {
    const queueLength = await getQueueLength();
    res.status(200).json({
      status: "healthy",
      instance: INSTANCE_ID,
      queueLength,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      status: "unhealthy",
      error: "Redis connection failed",
    });
  }
});

async function initializeDatabase() {
  try {
    client = new MongoClient(mongoUri, mongoClientOptions);
    await client.connect();
    db = client.db();
    console.log("✅ Connected to MongoDB");

    const paymentsCollection = db.collection("payments");
    await paymentsCollection.createIndex({ requested_at: 1 });
    console.log("✅ Database indexes created");

    consumePaymentsFromQueueWithInterval();
    verifyServiceAvailabilityWithInterval();
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}

async function initializeRedis() {
  // Redis is now initialized in paymentQueue.ts
  console.log("✅ Redis initialization handled by paymentQueue module");
}

// Start server
async function startServer() {
  await initializeDatabase();
  await initializeRedis();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} (Instance: ${INSTANCE_ID})`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🌐 API base URL: http://localhost:${PORT}`);
  });
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  stopPaymentConsumer();
  if (client) {
    await client.close();
  }
  await closeRedisClient();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully");
  stopPaymentConsumer();
  if (client) {
    await client.close();
  }
  await closeRedisClient();
  process.exit(0);
});

startServer().catch(console.error);
