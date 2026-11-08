import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getStore } from "@/lib/store";
import { quoteFor } from "@/lib/orders";
import { formatILS } from "@/lib/money";
import { formatDateTimeHe, longDateHe } from "@/lib/time";
import { DRINKS } from "@/lib/config";
import { ADMIN_SETTABLE, PAYMENT_LABELS, STATUS_LABELS } from "@/lib/labels";
import { AdminShell, Panel, StatusBadge, inputCls, statusTone } from "../../ui";
import { ActionForm, SubmitOnChange } from "../../forms";
import { refundOrder, setOrderStatus } from "../../actions";

export default function AdminOrderPage(props: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense fallback={<div className="p-6 text-muted">טוען…</div>}>
      <AdminOrder params={props.params} />
    </Suspense>
  );
}

async function AdminOrder({ params }: { params: PageProps<"/admin/orders/[id]">["params"] }) {
  await connection();
  await requireAdmin();
  const { id } = await params;
  const store = getStore();
  const [order, settings] = await Promise.all([store.getOrder(id), store.getSettings()]);
  if (!order) notFound();
  const quote = quoteFor(order, settings);
  const canRefund = order.paymentStatus === "paid" && !order.refundedAt && !order.refundStartedAt && order.status !== "cancelled";

  return (
    <AdminShell active="orders">
      <Link href={`/admin?date=${order.fridayDate}`} className="text-[14px] text-muted hover:text-ink">
        → כל ההזמנות ל{longDateHe(order.fridayDate)}
      </Link>
      <div className="mt-2 mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-[24px] font-extrabold">הזמנה {order.orderNumber}</h1>
        <StatusBadge label={STATUS_LABELS[order.status]} tone={statusTone(order)} />
        <StatusBadge label={`תשלום: ${PAYMENT_LABELS[order.paymentStatus]}`} tone={order.paymentStatus === "paid" ? "ok" : "muted"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Panel title="פרטים">
            <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-[15px]">
              <dt className="text-muted">לקוח</dt>
              <dd>{order.customerName}</dd>
              <dt className="text-muted">טלפון</dt>
              <dd>
                <a href={`tel:${order.phone}`} className="tabular underline-offset-4 hover:underline" dir="ltr">
                  {order.phone}
                </a>
                {" · "}
                <a href={`https://wa.me/972${order.phone.slice(1)}`} target="_blank" rel="noopener" className="text-muted underline underline-offset-4">
                  וואטסאפ
                </a>
              </dd>
              <dt className="text-muted">קבלה</dt>
              <dd>
                {order.fulfillment === "delivery"
                  ? `משלוח · ${[order.address, order.apartment && `דירה ${order.apartment}`, order.floor && `קומה ${order.floor}`].filter(Boolean).join(", ")}`
                  : "איסוף עצמי"}
              </dd>
              {order.deliveryNotes && (
                <>
                  <dt className="text-muted">הערות</dt>
                  <dd>{order.deliveryNotes}</dd>
                </>
              )}
              <dt className="text-muted">נוצרה</dt>
              <dd className="tabular">{formatDateTimeHe(order.createdAt)}</dd>
              {order.paidAt && (
                <>
                  <dt className="text-muted">שולמה</dt>
                  <dd className="tabular">
                    {formatDateTimeHe(order.paidAt)} · {order.paymentProvider} {order.paymentRef && `(${order.paymentRef})`}
                  </dd>
                </>
              )}
              <dt className="text-muted">הודעת אישור</dt>
              <dd>{order.notifiedAt ? `נשלחה ${formatDateTimeHe(order.notifiedAt)}` : "לא נשלחה"}</dd>
            </dl>
          </Panel>

          <Panel title="פריטים">
            <ul className="divide-y divide-line text-[15px]">
              {order.items.map((i, k) => (
                <li key={k} className="flex justify-between py-2">
                  <span>
                    {i.name}
                    {i.drink && <span className="text-muted"> · {DRINKS.find((d) => d.id === i.drink)?.label}</span>}
                    <span className="tabular font-bold"> ×{i.quantity}</span>
                  </span>
                  <span className="tabular">{formatILS(i.unitPriceAgorot * i.quantity)}</span>
                </li>
              ))}
              {order.deliveryFeeAgorot > 0 && (
                <li className="flex justify-between py-2 text-muted">
                  <span>משלוח</span>
                  <span className="tabular">{formatILS(order.deliveryFeeAgorot)}</span>
                </li>
              )}
              <li className="flex justify-between py-2 font-bold">
                <span>סה״כ</span>
                <span className="tabular">{formatILS(order.totalAgorot)}</span>
              </li>
            </ul>
          </Panel>
        </div>

        <div className="space-y-4">
          {order.paymentStatus === "paid" && ADMIN_SETTABLE.includes(order.status) && (
            <Panel title="סטטוס">
              <form action={setOrderStatus}>
                <input type="hidden" name="id" value={order.id} />
                <SubmitOnChange>
                  <label htmlFor="status" className="sr-only">
                    סטטוס הזמנה
                  </label>
                  <select id="status" name="status" defaultValue={order.status} className={inputCls}>
                    {ADMIN_SETTABLE.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </SubmitOnChange>
                <noscript>
                  <button className="mt-2 h-10 rounded-lg bg-ink px-4 text-white">עדכון</button>
                </noscript>
              </form>
            </Panel>
          )}

          <Panel title="ביטול והחזר">
            {order.cancelRequestedAt && (
              <p className="mb-2 text-[14px]">
                בקשת ביטול: <span className="tabular">{formatDateTimeHe(order.cancelRequestedAt)}</span>
                {order.cancelReason && <span className="block text-muted">״{order.cancelReason}״</span>}
              </p>
            )}
            {order.refundedAt ? (
              <p className="text-[14px]">
                הוחזרו <b className="tabular">{formatILS(order.refundAgorot ?? 0)}</b> ב-{formatDateTimeHe(order.refundedAt)}
                {order.refundRef && <span className="block text-muted">אסמכתא: {order.refundRef}</span>}
              </p>
            ) : order.refundStartedAt ? (
              <p className="text-[14px] text-accent">החזר בתהליך (התחיל {formatDateTimeHe(order.refundStartedAt)}).</p>
            ) : canRefund ? (
              <>
                <p className="mb-2 text-[13px] text-muted">
                  {quote.window === "free"
                    ? "הבקשה בתוך חלון הביטול ללא עלות — מומלץ החזר מלא."
                    : quote.window === "after_fulfillment"
                      ? "הבקשה אחרי מועד ההזמנה — לבדיקה ידנית."
                      : settings.cancellation.lateFeePercent && !settings.cancellation.lateFeeApproved
                        ? `ביטול מאוחר. דמי ביטול (${settings.cancellation.lateFeePercent}%) לא מופעלים אוטומטית עד שהמדיניות תאושר משפטית — ההחלטה ידנית.`
                        : `ביטול מאוחר — לפי המדיניות המאושרת.`}
                </p>
                <ActionForm action={refundOrder} submitLabel="ביצוע החזר וביטול" confirm="לבצע את ההחזר ולבטל את ההזמנה? לא ניתן לבטל פעולה זו.">
                  <input type="hidden" name="id" value={order.id} />
                  <label htmlFor="amount" className="mb-1 block text-[13px] font-medium text-muted">
                    סכום להחזר (₪) · 0 = ביטול ללא החזר
                  </label>
                  <input
                    id="amount"
                    name="amount"
                    inputMode="decimal"
                    defaultValue={(quote.suggestedRefundAgorot / 100).toString()}
                    className={inputCls}
                  />
                </ActionForm>
              </>
            ) : (
              <p className="text-[14px] text-muted">אין פעולות זמינות להזמנה הזו.</p>
            )}
          </Panel>
        </div>
      </div>
    </AdminShell>
  );
}
