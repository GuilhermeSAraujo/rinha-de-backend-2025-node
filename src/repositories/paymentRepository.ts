import { getRedisClient } from "../config/redis";
import { PaymentLog, PaymentSummary } from "../types/payment";

export const PaymentRepository = {
  savePayment: async (payment: PaymentLog) => {
    const sortedSetKey = "payments_by_date";
    const summaryConnection = await getRedisClient();

    const score = new Date(payment.requestedAt).getTime();

    const member = `${payment.amount}|${payment.processor}|${payment.correlationId}`;

    await summaryConnection.zAdd(sortedSetKey, {
      score: score,
      value: member,
    });
  },

  getSummary: async (from?: string, to?: string): Promise<PaymentSummary> => {
    const sortedSetKey = "payments_by_date";
    const summaryConnection = await getRedisClient();

    const minScore = from ? new Date(from).getTime() : "-inf";
    const maxScore = to ? new Date(to).getTime() : "+inf";

    const payments = await summaryConnection.zRangeByScore(sortedSetKey, minScore, maxScore);

    const summary: PaymentSummary = {
      default: { totalRequests: 0, totalAmount: 0 },
      fallback: { totalRequests: 0, totalAmount: 0 },
    };

    for (const payment of payments) {
      const [amountStr, processor] = payment.split("|");
      const amount = parseFloat(amountStr);

      if (summary[processor as keyof PaymentSummary]) {
        summary[processor as keyof PaymentSummary].totalRequests += 1;
        summary[processor as keyof PaymentSummary].totalAmount += amount;
      }
    }
    return summary;
  },

  resetDatabaseData: async (): Promise<void> => {
    const summaryConnection = await getRedisClient();
    await summaryConnection.flushDb();
  },
};
