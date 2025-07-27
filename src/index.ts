import { createExpressApp } from "./config/express";
import { initializeRedisClient } from "./config/redis";
import { PaymentController } from "./controllers/paymentController";
import { startServiceHealthMonitor, startWorkers } from "./workers/paymentWorker";

const PORT = process.env["PORT"] || 3000;
const INSTANCE_ID = process.env["INSTANCE_ID"] || "unknown";

const app = createExpressApp(INSTANCE_ID);

app.post("/payments", PaymentController.createPayment);
app.get("/payments-summary", PaymentController.getPaymentsSummary);
app.post("/purge-payments", PaymentController.purgePayments);
app.get("/health", PaymentController.healthCheck);

async function startServer() {
  await initializeRedisClient();

  startWorkers(15);
  startServiceHealthMonitor(INSTANCE_ID);

  app.listen(PORT, () => {
    console.log(`Server running`);
  });
}

startServer().catch(console.error);
