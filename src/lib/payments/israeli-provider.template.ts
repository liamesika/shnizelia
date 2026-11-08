import "server-only";
import { PaymentNotConfiguredError, type PaymentProvider } from "./types";

/**
 * TEMPLATE — integration point for the real Israeli payment provider.
 *
 * Nothing here talks to a real API yet. Pick a provider (e.g. Grow/Meshulam,
 * PayPlus, Cardcom, Tranzila, Hyp), open a merchant account, then implement
 * the three methods from that provider's official docs:
 *
 * 1. createPayment — create a hosted payment page / payment link for
 *    order.totalAgorot (convert to ₪), pass order.id as your reference
 *    ("more_info"/"custom field"), set success/cancel/notify URLs, and enable
 *    Apple Pay / Google Pay if the provider supports it on hosted pages.
 *    Return the page URL. Card data must stay on the provider's page.
 *
 * 2. verifyWebhook — authenticate the callback the provider's documented way
 *    (signature/hash header, or call the provider's "get transaction" API with
 *    the transaction id). Return null if it can't be proven genuine. Map the
 *    provider's fields to { orderId, providerRef, amountAgorot, outcome }.
 *
 * 3. refund — call the provider's refund endpoint for amountAgorot against
 *    order.paymentRef. Pass a stable idempotency key if the API supports it
 *    (e.g. `refund-${order.id}`).
 *
 * Then register it in ./index.ts and set PAYMENT_PROVIDER=<id> plus the
 * provider's keys in the environment.
 */
export const israeliProvider: PaymentProvider = {
  id: "provider",
  async createPayment() {
    throw new PaymentNotConfiguredError("Real payment provider not implemented yet — see israeli-provider.template.ts");
  },
  async verifyWebhook() {
    return null;
  },
  async refund() {
    throw new PaymentNotConfiguredError("Refunds require the real payment provider");
  },
};
