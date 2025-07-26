import express from "express";
import { closeRedisClient, initializeRedisClient } from "./config/redis";
import { PaymentController } from "./controllers/paymentController";
import { startServiceHealthMonitor, startWorkers, stopWorkers } from "./workers/paymentWorker";

const app = express();
const PORT = process.env["PORT"] || 3000;
const INSTANCE_ID = process.env["INSTANCE_ID"] || "unknown";

// Store instance ID in app for access in controllers
app.set("instanceId", INSTANCE_ID);

// Optimize Express for high performance
app.use(
  express.json({
    limit: "1mb",
    type: "application/json",
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
    type: "application/x-www-form-urlencoded",
  })
);

// Disable unnecessary middleware for performance
app.disable("x-powered-by");
app.disable("etag");
app.set("trust proxy", 1);

// Set default response headers for performance
app.use((_req, res, next) => {
  res.set({
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
  });
  next();
});

// Routes
app.post("/payments", PaymentController.createPayment);
app.get("/payments-summary", PaymentController.getPaymentsSummary);
app.post("/purge-payments", PaymentController.purgePayments);
app.get("/health", PaymentController.healthCheck);

async function initializeRedis() {
  try {
    await initializeRedisClient();
    console.log("✅ Redis initialization completed");
  } catch (error) {
    console.error("❌ Failed to initialize Redis:", error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  await initializeRedis();

  // Start payment processing with worker-based system
  startWorkers(20); // Start with 20 concurrent workers
  startServiceHealthMonitor(INSTANCE_ID);

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} (Instance: ${INSTANCE_ID})`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🌐 API base URL: http://localhost:${PORT}`);
  });
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  stopWorkers();
  await closeRedisClient();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully");
  stopWorkers();
  await closeRedisClient();
  process.exit(0);
});

startServer().catch(console.error);
