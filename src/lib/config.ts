import type { Drink, Product, Settings } from "./types";

export const TIMEZONE = "Asia/Jerusalem";

export const DRINKS: Drink[] = [
  { id: "cola", label: "קולה" },
  { id: "zero", label: "קולה זירו" },
  { id: "soda", label: "סודה" },
];
export const DEFAULT_DRINK = "zero" as const;

/** A pending (unpaid) order holds stock for this many minutes. */
export const PAYMENT_HOLD_MINUTES = 20;
export const MAX_QTY_PER_LINE = 20;

/**
 * Initial data — used to seed the database. Everything here is editable from
 * /admin/settings. Pickup/delivery texts are deliberately empty: the owner
 * fills them in; nothing is invented.
 */
export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "schnitzel",
    name: "חלת שניצל + שתייה",
    description: "חלת שניצל מפנקת עם שתייה לבחירה.",
    priceAgorot: 5500,
    image: "/products/schnitzel.jpg",
    imageAlt: "חלת שניצל עם שניצל פריך וחציל",
    available: true,
    weeklyLimit: null,
    requiresDrink: true,
    sortOrder: 1,
  },
  {
    id: "challah",
    name: "זוג חלות לשבת",
    description: "שתי חלות טריות לשולחן השבת.",
    priceAgorot: 3800,
    image: "/products/challah.jpg",
    imageAlt: "שתי חלות קלועות עם שומשום",
    available: true,
    weeklyLimit: null,
    requiresDrink: false,
    sortOrder: 2,
  },
];

export const DEFAULT_SETTINGS: Settings = {
  brandName: "השישי",
  orderingOpen: true,
  cutoffWeekday: 4,
  cutoffTime: "16:00",
  weeksAhead: 2,
  pickup: { enabled: true, locationText: "", hoursText: "" },
  delivery: { enabled: false, feeAgorot: 700, addresses: [], hoursText: "" },
  cancellation: {
    freeUntilWeekday: 4,
    freeUntilTime: "09:00",
    lateFeePercent: 50,
    lateFeeApproved: false,
    policyText:
      "ביטול ללא עלות עד יום חמישי ב־09:00. בקשות ביטול לאחר מכן ייבדלו ידנית בהתאם למדיניות העסק ולדין.",
  },
  supportPhone: "",
};
