import type { Order } from "../types";

export interface CreatePaymentInput {
  order: Order;
  /** Where the customer returns after paying (the confirmation page). */
  successUrl: string;
  /** Where the customer returns if they cancel at the provider. */
  cancelUrl: string;
  /** Server-to-server notification URL. */
  webhookUrl: string;
}

export interface VerifiedPaymentEvent {
  orderId: string;
  providerRef: string | null;
  amountAgorot: number;
  outcome: "paid" | "failed";
}

/**
 * One adapter per payment company. The rest of the app only talks to this.
 * Card details never touch our server — the customer pays on the provider's
 * hosted page / iframe.
 */
export interface PaymentProvider {
  id: string;
  createPayment(input: CreatePaymentInput): Promise<{ paymentUrl: string; providerRef: string | null }>;
  /**
   * Authenticates and parses a webhook. MUST verify the signature (or re-query
   * the provider's API) — return null for anything that isn't proven genuine.
   */
  verifyWebhook(request: Request): Promise<VerifiedPaymentEvent | null>;
  refund(input: { order: Order; amountAgorot: number }): Promise<{ refundRef: string | null }>;
}

export class PaymentNotConfiguredError extends Error {
  constructor(message = "Payment provider is not configured") {
    super(message);
  }
}
