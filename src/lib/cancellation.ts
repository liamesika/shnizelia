import type { Order, Settings } from "./types";
import { cutoffFor } from "./cycle";
import { parseISODate, zonedTimeToUtc } from "./time";

export interface CancellationQuote {
  window: "free" | "late" | "after_fulfillment";
  /** Refund the system suggests. Admin can still adjust before processing. */
  suggestedRefundAgorot: number;
  /** True when a person must review before any refund is made. */
  requiresReview: boolean;
  freeUntil: string; // ISO instant
}

/**
 * Server-side refund calculation based on the time the request was made.
 * The late fee is applied only if the owner has marked the policy as legally
 * approved (settings.cancellation.lateFeeApproved). Until then a late request
 * suggests a full refund and is flagged for manual review.
 */
export function quoteCancellation(order: Order, settings: Settings, requestedAt: Date): CancellationQuote {
  const friday = parseISODate(order.fridayDate)!;
  const c = settings.cancellation;
  const freeUntil = cutoffFor(friday, c.freeUntilWeekday, c.freeUntilTime);
  const fulfillmentStart = zonedTimeToUtc(friday, "00:00");
  const paid = order.totalAgorot;

  if (requestedAt < freeUntil) {
    return { window: "free", suggestedRefundAgorot: paid, requiresReview: false, freeUntil: freeUntil.toISOString() };
  }
  if (requestedAt >= fulfillmentStart) {
    return { window: "after_fulfillment", suggestedRefundAgorot: 0, requiresReview: true, freeUntil: freeUntil.toISOString() };
  }
  if (c.lateFeeApproved) {
    const fee = Math.round((paid * c.lateFeePercent) / 100);
    return { window: "late", suggestedRefundAgorot: paid - fee, requiresReview: false, freeUntil: freeUntil.toISOString() };
  }
  return { window: "late", suggestedRefundAgorot: paid, requiresReview: true, freeUntil: freeUntil.toISOString() };
}
