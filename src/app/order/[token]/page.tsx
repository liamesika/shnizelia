import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getStore } from "@/lib/store";
import { formatILS } from "@/lib/money";
import { longDateHe } from "@/lib/time";
import { DRINKS } from "@/lib/config";
import { STATUS_LABELS } from "@/lib/labels";
import type { Order, Settings } from "@/lib/types";
import { ClearCartOnce, PendingPoller } from "@/components/order-client-bits";

export const metadata: Metadata = { title: "ההזמנה שלך", referrer: "no-referrer" };

export default function OrderPage(props: PageProps<"/order/[token]">) {
  return (
    <main className="mx-auto max-w-md px-5 pt-10 pb-16">
      <Suspense fallback={<div className="h-80 bg-sesame" aria-busy="true" />}>
        <OrderData params={props.params} />
      </Suspense>
    </main>
  );
}

async function OrderData({ params }: { params: PageProps<"/order/[token]">["params"] }) {
  await connection();
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) notFound();
  const store = getStore();
  const [order, settings] = await Promise.all([store.getOrderByToken(token), store.getSettings()]);
  if (!order) notFound();

  if (order.status === "pending_payment") {
    return (
      <div className="text-center" role="status">
        <span className="mx-auto mb-5 block size-8 border-3 border-zaatar border-t-transparent motion-safe:animate-spin" aria-hidden="true" />
        <h1 className="font-display text-[32px] leading-none">מאמתים את התשלום…</h1>
        <p className="mt-2 text-[15px] text-muted">זה לוקח רק כמה שניות. אין צורך לרענן.</p>
        <PendingPoller />
      </div>
    );
  }

  if (order.status === "payment_failed") {
    return (
      <div className="text-center">
        <h1 className="font-display text-[32px] leading-none">התשלום לא הושלם</h1>
        <p className="mt-2 text-[15px] text-muted">לא חויבתם וההזמנה לא נקלטה. אפשר לנסות שוב.</p>
        <Link href="/checkout" className="mt-6 inline-flex h-14 items-center bg-zaatar px-6 font-semibold text-white">
          חזרה לתשלום
        </Link>
      </div>
    );
  }

  const isCancelled = order.status === "cancelled" || order.status === "cancel_requested";
  return (
    <div>
      <ClearCartOnce />
      {isCancelled ? (
        <>
          <h1 className="font-display text-[34px] leading-none">{STATUS_LABELS[order.status]}</h1>
          <p className="mt-2 text-[15px] text-muted">
            {order.status === "cancel_requested"
              ? "קיבלנו את בקשת הביטול. נעדכן אתכם לגבי ההחזר."
              : order.refundAgorot
                ? `ההזמנה בוטלה. הוחזרו ${formatILS(order.refundAgorot)}.`
                : "ההזמנה בוטלה."}
          </p>
        </>
      ) : (
        <>
          <h1 className="rise font-display text-[38px] leading-[1.05]">איזה כיף, ההזמנה התקבלה! 🤎</h1>
          <p className="rise mt-3 inline-block bg-yolk px-3 py-1.5 text-[17px] font-semibold" style={{ "--d": "200ms" } as React.CSSProperties}>נתראה בשישי!</p>
        </>
      )}

      <OrderSummary order={order} settings={settings} />

      {!isCancelled && ["paid", "preparing", "ready"].includes(order.status) && (
        <p className="mt-6 text-center text-[14px]">
          <Link href={`/order/${order.publicToken}/cancel`} className="text-muted underline underline-offset-4 hover:text-ink">
            צריכים לבטל?
          </Link>
        </p>
      )}
      {settings.supportPhone && (
        <p className="mt-3 text-center text-[13px] text-muted">
          שאלות? <a href={`tel:${settings.supportPhone}`} className="tabular underline underline-offset-4" dir="ltr">{settings.supportPhone}</a>
        </p>
      )}
    </div>
  );
}

function OrderSummary({ order, settings }: { order: Order; settings: Settings }) {
  const instructions =
    order.fulfillment === "pickup"
      ? [settings.pickup.locationText, settings.pickup.hoursText].filter(Boolean).join(" · ")
      : settings.delivery.hoursText;
  return (
    <dl className="rise mt-8 divide-y divide-line border-y-2 border-ink text-[15px]" style={{ "--d": "320ms" } as React.CSSProperties}>
      <Row label="מספר הזמנה">
        <span className="tabular font-num text-[22px] leading-none">{order.orderNumber}</span>
      </Row>
      <Row label="מתי">{longDateHe(order.fridayDate)}</Row>
      <Row label="קבלה">
        {order.fulfillment === "delivery" ? (
          <>
            משלוח עד הבית
            <span className="block text-muted">
              {[order.address, order.apartment && `דירה ${order.apartment}`, order.floor && `קומה ${order.floor}`].filter(Boolean).join(", ")}
            </span>
          </>
        ) : (
          <>
            איסוף עצמי
            {instructions && <span className="block text-muted">{instructions}</span>}
          </>
        )}
      </Row>
      {order.fulfillment === "delivery" && instructions && <Row label="שעות">{instructions}</Row>}
      <div className="py-3">
        <dt className="sr-only">פריטים</dt>
        <dd>
          <ul className="space-y-1">
            {order.items.map((i, idx) => (
              <li key={idx} className="flex justify-between gap-3">
                <span>
                  {i.name}
                  {i.drink && <span className="text-muted"> · {DRINKS.find((d) => d.id === i.drink)?.label}</span>}
                  <span className="tabular text-muted"> ×{i.quantity}</span>
                </span>
                <span className="tabular">{formatILS(i.unitPriceAgorot * i.quantity)}</span>
              </li>
            ))}
            {order.deliveryFeeAgorot > 0 && (
              <li className="flex justify-between text-muted">
                <span>משלוח</span>
                <span className="tabular">{formatILS(order.deliveryFeeAgorot)}</span>
              </li>
            )}
          </ul>
        </dd>
      </div>
      <Row label="סה״כ שולם">
        <span className="tabular font-num text-[26px] leading-none">{formatILS(order.totalAgorot)}</span>
      </Row>
    </dl>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-left">{children}</dd>
    </div>
  );
}
