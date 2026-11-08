import { test } from "node:test";
import assert from "node:assert/strict";
import { getOrderingCycle, cutoffFor } from "../src/lib/cycle";
import { quoteCancellation } from "../src/lib/cancellation";
import { zonedTimeToUtc } from "../src/lib/time";
import { prepSummary } from "../src/lib/prep";
import { normalizeIsraeliPhone } from "../src/lib/validation";
import { DEFAULT_SETTINGS } from "../src/lib/config";
import type { Order } from "../src/lib/types";

const S = DEFAULT_SETTINGS;
const at = (iso: string) => new Date(iso);

test("Thursday 16:00 Israel = 14:00Z in winter (UTC+2)", () => {
  assert.equal(cutoffFor({ y: 2026, m: 11, d: 13 }, 4, "16:00").toISOString(), "2026-11-12T14:00:00.000Z");
});

test("Thursday 16:00 Israel = 13:00Z in summer (UTC+3)", () => {
  assert.equal(cutoffFor({ y: 2026, m: 7, d: 10 }, 4, "16:00").toISOString(), "2026-07-09T13:00:00.000Z");
});

test("DST edge: Friday right after the spring change (Mar 27 2026 is the switch day)", () => {
  // Israel moved to summer time on Fri 27.3.2026 02:00. Thursday 26.3 is still winter.
  assert.equal(cutoffFor({ y: 2026, m: 3, d: 27 }, 4, "16:00").toISOString(), "2026-03-26T14:00:00.000Z");
  assert.equal(cutoffFor({ y: 2026, m: 4, d: 3 }, 4, "16:00").toISOString(), "2026-04-02T13:00:00.000Z");
});

test("DST edge: autumn change (Oct 25 2026)", () => {
  assert.equal(cutoffFor({ y: 2026, m: 10, d: 23 }, 4, "16:00").toISOString(), "2026-10-22T13:00:00.000Z");
  assert.equal(cutoffFor({ y: 2026, m: 10, d: 30 }, 4, "16:00").toISOString(), "2026-10-29T14:00:00.000Z");
});

test("Sunday → this Friday open", () => {
  const c = getOrderingCycle(at("2026-11-08T20:00:00Z"), S, []);
  assert.equal(c.open, true);
  assert.equal(c.fridayDate, "2026-11-13");
  assert.equal(c.rolledOver, false);
});

test("Thursday 15:59 Israel → still this Friday", () => {
  const c = getOrderingCycle(at("2026-11-12T13:59:00Z"), S, []);
  assert.equal(c.fridayDate, "2026-11-13");
});

test("Thursday 16:00 Israel exactly → rolls to next Friday", () => {
  const c = getOrderingCycle(at("2026-11-12T14:00:00Z"), S, []);
  assert.equal(c.fridayDate, "2026-11-20");
  assert.equal(c.rolledOver, true);
});

test("Friday and Saturday → next Friday, not rolled-over wording", () => {
  assert.equal(getOrderingCycle(at("2026-11-13T09:00:00Z"), S, []).fridayDate, "2026-11-20");
  const sat = getOrderingCycle(at("2026-11-14T21:00:00Z"), S, []); // Sat 23:00 Israel
  assert.equal(sat.fridayDate, "2026-11-20");
  assert.equal(sat.rolledOver, false);
});

test("Late Saturday night UTC that is already Sunday in Israel", () => {
  const c = getOrderingCycle(at("2026-11-14T22:30:00Z"), S, []); // Sun 00:30 Israel
  assert.equal(c.fridayDate, "2026-11-20");
});

test("Closed Friday override skips to the following one", () => {
  const c = getOrderingCycle(at("2026-11-08T20:00:00Z"), S, [{ date: "2026-11-13", closed: true, note: "" }]);
  assert.equal(c.fridayDate, "2026-11-20");
  assert.equal(c.rolledOver, true);
});

test("Master switch off → closed", () => {
  const c = getOrderingCycle(at("2026-11-08T20:00:00Z"), { ...S, orderingOpen: false }, []);
  assert.equal(c.open, false);
  assert.equal(c.closedReason, "paused");
});

test("All Fridays within range closed → closed, no charge possible", () => {
  const o = ["2026-11-13", "2026-11-20", "2026-11-27"].map((date) => ({ date, closed: true, note: "" }));
  const c = getOrderingCycle(at("2026-11-08T20:00:00Z"), S, o);
  assert.equal(c.open, false);
  assert.equal(c.fridayDate, null);
});

const order = (over: Partial<Order> = {}): Order =>
  ({ fridayDate: "2026-11-13", totalAgorot: 9300, status: "paid", paymentStatus: "paid", fulfillment: "pickup", items: [], ...over }) as Order;

test("Cancellation: before Thursday 09:00 → free, full refund", () => {
  const q = quoteCancellation(order(), S, at("2026-11-12T06:59:00Z"));
  assert.equal(q.window, "free");
  assert.equal(q.suggestedRefundAgorot, 9300);
  assert.equal(q.requiresReview, false);
});

test("Cancellation: after 09:00, fee NOT approved → full refund suggested + manual review", () => {
  const q = quoteCancellation(order(), S, at("2026-11-12T07:00:00Z"));
  assert.equal(q.window, "late");
  assert.equal(q.suggestedRefundAgorot, 9300);
  assert.equal(q.requiresReview, true);
});

test("Cancellation: after 09:00 with approved 50% fee", () => {
  const s = { ...S, cancellation: { ...S.cancellation, lateFeeApproved: true } };
  const q = quoteCancellation(order(), s, at("2026-11-12T10:00:00Z"));
  assert.equal(q.suggestedRefundAgorot, 4650);
});

test("zonedTimeToUtc round trip", () => {
  assert.equal(zonedTimeToUtc({ y: 2026, m: 1, d: 1 }, "00:00").toISOString(), "2025-12-31T22:00:00.000Z");
});

test("Prep summary counts only paid, non-cancelled", () => {
  const s = prepSummary([
    order({ items: [{ productId: "schnitzel", name: "", unitPriceAgorot: 5500, quantity: 2, drink: "zero" }, { productId: "challah", name: "", unitPriceAgorot: 3800, quantity: 1, drink: null }] }),
    order({ fulfillment: "delivery", items: [{ productId: "schnitzel", name: "", unitPriceAgorot: 5500, quantity: 1, drink: "cola" }] }),
    order({ status: "cancelled", items: [{ productId: "schnitzel", name: "", unitPriceAgorot: 5500, quantity: 5, drink: "soda" }] }),
    order({ status: "pending_payment", paymentStatus: "pending", items: [{ productId: "challah", name: "", unitPriceAgorot: 3800, quantity: 9, drink: null }] }),
  ]);
  assert.equal(s.sandwiches, 3);
  assert.deepEqual(s.drinks, { cola: 1, zero: 2, soda: 0 });
  assert.equal(s.challahPairs, 1);
  assert.equal(s.challahs, 2);
  assert.equal(s.deliveries, 1);
  assert.equal(s.pickups, 1);
});

test("Phone normalization", () => {
  assert.equal(normalizeIsraeliPhone("050-123-4567"), "0501234567");
  assert.equal(normalizeIsraeliPhone("+972 50 123 4567"), "0501234567");
  assert.equal(normalizeIsraeliPhone("12345"), null);
});
