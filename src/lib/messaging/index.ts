import "server-only";
import type { Order, Settings } from "../types";
import { DRINKS } from "../config";
import { formatILS } from "../money";
import { longDateHe } from "../time";

/** The confirmation text sent by WhatsApp/SMS. Same essentials as the confirmation page. */
export function confirmationText(order: Order, settings: Settings, orderUrl: string): string {
  const lines = order.items.map((i) => {
    const drink = i.drink ? ` (${DRINKS.find((d) => d.id === i.drink)?.label})` : "";
    return `• ${i.name}${drink} × ${i.quantity}`;
  });
  const where =
    order.fulfillment === "delivery"
      ? `משלוח: ${[order.address, order.apartment && `דירה ${order.apartment}`].filter(Boolean).join(", ")}`
      : `איסוף עצמי${settings.pickup.locationText ? ` — ${settings.pickup.locationText}` : ""}`;
  return [
    `איזה כיף, ההזמנה התקבלה! 🤎`,
    `הזמנה מס׳ ${order.orderNumber} · ${longDateHe(order.fridayDate)}`,
    ...lines,
    where,
    `סה״כ שולם: ${formatILS(order.totalAgorot)}`,
    `פרטי ההזמנה: ${orderUrl}`,
    `נתראה בשישי!`,
  ].join("\n");
}

/**
 * Sends the confirmation if a messaging integration is configured.
 * MESSAGING_PROVIDER=webhook posts JSON { to, text, order } to MESSAGING_WEBHOOK_URL
 * (e.g. a Make/n8n scenario or your WhatsApp/SMS gateway). Anything else = off.
 * Never throws — a failed message must not affect the saved order.
 */
export async function sendOrderConfirmation(order: Order, settings: Settings, orderUrl: string): Promise<boolean> {
  try {
    if (process.env.MESSAGING_PROVIDER !== "webhook" || !process.env.MESSAGING_WEBHOOK_URL) return false;
    const to = "972" + order.phone.replace(/^0/, "");
    const res = await fetch(process.env.MESSAGING_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.MESSAGING_WEBHOOK_SECRET ? { authorization: `Bearer ${process.env.MESSAGING_WEBHOOK_SECRET}` } : {}),
      },
      body: JSON.stringify({ to, text: confirmationText(order, settings, orderUrl), orderNumber: order.orderNumber }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch (err) {
    console.error("[messaging] confirmation failed", order.orderNumber, err);
    return false;
  }
}
