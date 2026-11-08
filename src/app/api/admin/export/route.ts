import { isAdmin } from "@/lib/admin-auth";
import { getStore } from "@/lib/store";
import { parseISODate } from "@/lib/time";
import { DRINKS } from "@/lib/config";
import { STATUS_LABELS, PAYMENT_LABELS } from "@/lib/labels";

function csvCell(v: unknown): string {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // spreadsheet formula injection guard
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!parseISODate(date)) return new Response("Bad date", { status: 400 });

  const orders = (await getStore().listOrders(date)).filter((o) => o.status !== "pending_payment");
  const header = ["מס׳ הזמנה", "שם", "טלפון", "מוצרים", "איסוף/משלוח", "כתובת", "דירה", "קומה", "הערות", "סטטוס", "תשלום", "סה״כ ₪"];
  const rows = orders.map((o) => [
    o.orderNumber,
    o.customerName,
    o.phone,
    o.items
      .map((i) => `${i.name}${i.drink ? ` (${DRINKS.find((d) => d.id === i.drink)?.label})` : ""} ×${i.quantity}`)
      .join(" | "),
    o.fulfillment === "delivery" ? "משלוח" : "איסוף",
    o.address ?? "",
    o.apartment ?? "",
    o.floor ?? "",
    o.deliveryNotes ?? "",
    STATUS_LABELS[o.status],
    PAYMENT_LABELS[o.paymentStatus],
    (o.totalAgorot / 100).toFixed(2),
  ]);
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="orders-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
