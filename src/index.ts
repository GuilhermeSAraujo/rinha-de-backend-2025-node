import express, { Request, Response } from "express";
import { MongoClient, Db, ReadPreference } from "mongodb";

const app = express();
const PORT = process.env["PORT"] || 3000;
const INSTANCE_ID = process.env["INSTANCE_ID"] || "unknown";

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

// Connection pool monitoring
let poolStats = {
  totalConnections: 0,
  availableConnections: 0,
  pendingConnections: 0,
  activeConnections: 0,
};

// Monitor connection pool every 30 seconds
setInterval(() => {
  if (client) {
    const pool = (client as any).topology?.s?.options?.maxPoolSize;
    console.log(`📊 MongoDB Pool Stats: ${JSON.stringify(poolStats)}`);
  }
}, 30000);

let db: Db;
let client: MongoClient;

// Payment processor URLs
const PAYMENT_PROCESSOR_DEFAULT_URL = "http://payment-processor-default:8080";
const PAYMENT_PROCESSOR_FALLBACK_URL = "http://payment-processor-fallback:8080";

// In-memory queue for payment requests
const failedPaymentsQueue: Array<{
  correlationId: string;
  amount: number;
  requestedAt: Date;
}> = [];

// Service availability tracking
let useDefaultService = true;

// Middleware
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Disable unnecessary middleware for performance
app.disable("x-powered-by");

// POST /payments - Accept payment requests
app.post("/payments", async (req: Request, res: Response) => {
  try {
    const { correlationId, amount } = req.body;

    if (!correlationId || typeof amount !== "number") {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const paymentRequest = {
      correlationId,
      amount,
      requestedAt: new Date(),
    };

    await processPayment(paymentRequest);

    // Return immediately (async processing)
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

    const queryStartTime = Date.now();
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
    const processingStartTime = Date.now();

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

    const processingTime = Date.now() - processingStartTime;

    result.default.totalAmount = Math.round(result.default.totalAmount * 100) / 100;
    result.fallback.totalAmount = Math.round(result.fallback.totalAmount * 100) / 100;

    const totalTime = Date.now() - startTime;
    console.log(`✅ Payments summary completed in ${totalTime}ms`);

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

// // Background task to process payment queue
// async function processPaymentQueue() {
//   while (true) {
//     if (paymentQueue.length > 0) {
//       const payment = paymentQueue.shift();
//       if (payment) {
//         await processPayment(payment);
//       }
//     } else {
//       await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay when queue is empty
//     }
//   }
// }

// let defaultServiceIsAvailable = true;
// let firstExecution = true;

// async function verifyDefaultService() {
//   if (INSTANCE_ID === "01" && firstExecution) {
//     firstExecution = false;
//     // await 6 seconds
//     await new Promise((resolve) => setTimeout(resolve, 6000));
//   }

//   console.log("Verifying default service health...");

//   try {
//     const response = await fetch(`${PAYMENT_PROCESSOR_DEFAULT_URL}/payments/service-health`);
//     if (!response.ok) {
//       const responseText = await response.text();
//       console.log("❌ Default service is not available", responseText);
//       return;
//     }

//     const data = (await response.json()) as { minResponseTime: number; failing: boolean };

//     defaultServiceIsAvailable = !data.failing;
//     console.log(`Default service is ${defaultServiceIsAvailable ? "available" : "unavailable"}`, {
//       minResponseTime: data.minResponseTime,
//       failing: data.failing,
//     });
//   } catch (error) {
//     console.error("Error checking default service health:", error);
//     defaultServiceIsAvailable = false;
//   }
// }

// // execute verifyDefaultService every 6 seconds
// setInterval(verifyDefaultService, 6_000);

async function retryFailedPayment() {
  if (failedPaymentsQueue.length > 0) {
    const payment = failedPaymentsQueue.shift();
    console.log("🔄 Retrying failed payment:", payment!.correlationId);
    // add 1 second delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await processPayment(payment!);
  }
}

// execute retryFailedPayment every 1 second
setInterval(retryFailedPayment, 1000);

async function processPayment(payment: {
  correlationId: string;
  amount: number;
  requestedAt: Date;
}) {
  const serviceUrl = useDefaultService
    ? PAYMENT_PROCESSOR_DEFAULT_URL
    : PAYMENT_PROCESSOR_FALLBACK_URL;
  const service = useDefaultService ? "default" : "fallback";

  const response = await fetch(`${serviceUrl}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Rinha-Token": "123",
    },
    body: JSON.stringify({
      correlationId: payment.correlationId,
      amount: payment.amount,
      requestedAt: payment.requestedAt,
    }),
  });

  if (response.ok) {
    // console.log("🟢 Payment processed successfully with service:", service);
    // Save successful payment to database
    const collection = db.collection("payments");
    await collection.insertOne({
      correlation_id: payment.correlationId,
      amount: payment.amount,
      service: service,
      requested_at: payment.requestedAt,
      success: true,
    });
  } else {
    // add to queue to retry failed payment
    failedPaymentsQueue.push(payment);
  }
}

// Initialize MongoDB connection
async function initializeDatabase() {
  try {
    client = new MongoClient(mongoUri, mongoClientOptions);
    await client.connect();
    db = client.db();
    console.log("✅ Connected to MongoDB");

    // Create indexes for better performance
    const paymentsCollection = db.collection("payments");
    await paymentsCollection.createIndex({ requested_at: 1 });
    console.log("✅ Database indexes created");

    // Start payment queue processor
    // processPaymentQueue();
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  await initializeDatabase();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} (Instance: ${INSTANCE_ID})`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🌐 API base URL: http://localhost:${PORT}`);
  });
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  if (client) {
    await client.close();
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully");
  if (client) {
    await client.close();
  }
  process.exit(0);
});

startServer().catch(console.error);
