import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider, VerifiedPaymentEvent } from "./types";

/**
 * Development-only provider. Sends the customer to /pay/mock where they can
 * simulate success/failure. The simulated webhook is HMAC-signed and goes
 * through exactly the same verification + processing path as a real one.
 * Never charges anything. Disabled in production unless ALLOW_MOCK_PAYMENTS=true.
 */
const secret = () => process.env.MOCK_PAYMENT_SECRET || process.env.SESSION_SECRET || "dev-mock-secret";

export function signMock(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("hex");
}

export const mockProvider: PaymentProvider = {
  id: "mock",
  async createPayment({ order }) {
    return { paymentUrl: `/pay/mock/${order.id}`, providerRef: `mock_${order.orderNumber}` };
  },
  async verifyWebhook(request): Promise<VerifiedPaymentEvent | null> {
    const body = await request.text();
    const sig = request.headers.get("x-mock-signature") ?? "";
    const expected = signMock(body);
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(body) as VerifiedPaymentEvent;
    return data;
  },
  async refund({ order, amountAgorot }) {
    return { refundRef: `mock_refund_${order.orderNumber}_${amountAgorot}` };
  },
};
