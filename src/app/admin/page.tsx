import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getStore } from "@/lib/store";
import { adminFridays, getOrderingCycle } from "@/lib/cycle";
import { prepSummary } from "@/lib/prep";
import { formatILS } from "@/lib/money";
import { longDateHe, parseISODate, shortDateHe } from "@/lib/time";
import { DRINKS } from "@/lib/config";
import { STATUS_LABELS } from "@/lib/labels";
import { AdminShell, Panel, StatusBadge, statusTone } from "./ui";
import { setFridayOverride } from "./actions";

export default function AdminOrdersPage(props: PageProps<"/admin">) {
  return (
    <Suspense fallback={<div className="p-6 text-muted">טוען…</div>}>
      <AdminOrders searchParams={props.searchParams} />
    </Suspense>
  );
}

async function AdminOrders({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  await connection();
  await requireAdmin();
  const sp = await searchParams;
  const store = getStore();
  const now = new Date();
  const [settings, overrides] = await Promise.all([store.getSettings(), store.getOverrides()]);
  const cycle = getOrderingCycle(now, settings, overrides);
  const fridays = adminFridays(now);
  const requested = typeof sp.date === "string" && parseISODate(sp.date) ? sp.date : null;
  const date = requested ?? cycle.fridayDate ?? fridays[4];
  const showAll = sp.all === "1";

  const all = await store.listOrders(date);
  const orders = showAll ? all : all.filter((o) => o.status !== "pending_payment" && o.status !== "payment_failed");
  const s = prepSummary(all);
  const closedOverride = overrides.find((o) => o.date === date && o.closed);
  const idx = fridays.indexOf(date);

  return (
    <AdminShell active="orders">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NavDate date={idx > 0 ? fridays[idx - 1] : null} label="שבוע קודם" arrow="→" />
          <h1 className="text-[22px] font-extrabold">{longDateHe(date)}</h1>
          <NavDate date={idx >= 0 && idx < fridays.length - 1 ? fridays[idx + 1] : null} label="שבוע הבא" arrow="←" />
        </div>
        <div className="flex items-center gap-2 text-[14px]">
          {cycle.fridayDate === date ? (
            <StatusBadge label="פתוח להזמנות" tone="ok" />
          ) : closedOverride ? (
            <StatusBadge label="סגור ידנית" tone="bad" />
          ) : (
            <StatusBadge label="לא פתוח כרגע" tone="muted" />
          )}
          <form action={setFridayOverride}>
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="mode" value={closedOverride ? "open" : "close"} />
            <button className="rounded-full border border-line px-3 py-1.5 hover:border-ink">
              {closedOverride ? "פתיחת השישי הזה" : "סגירת השישי הזה"}
            </button>
          </form>
          <a href={`/api/admin/export?date=${date}`} className="rounded-full border border-line px-3 py-1.5 hover:border-ink">
            ייצוא CSV
          </a>
        </div>
      </div>

      {!settings.orderingOpen && (
        <p className="mb-4 rounded-xl bg-[#F6E7E3] px-4 py-3 text-[14px] text-danger">
          ההזמנות סגורות לגמרי (מתג ראשי בהגדרות).
        </p>
      )}

      <Panel title="מה להכין">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="חלות שניצל" value={s.sandwiches} big />
          <Stat label="זוגות חלות" value={s.challahPairs} sub={`${s.challahs} חלות`} big />
          <Stat label="משלוחים" value={s.deliveries} />
          <Stat label="איסופים" value={s.pickups} />
          {DRINKS.map((d) => (
            <Stat key={d.id} label={d.label} value={s.drinks[d.id]} />
          ))}
          <Stat label="הזמנות / הכנסה" value={s.orders} sub={formatILS(s.revenueAgorot)} />
        </div>
        {s.pendingCancellations > 0 && (
          <p className="mt-3 text-[13px] text-accent">
            כולל {s.pendingCancellations} הזמנות עם בקשת ביטול שטרם טופלה.
          </p>
        )}
      </Panel>

      <div className="mt-4">
        <Panel
          title={`הזמנות (${orders.length})`}
          aside={
            <Link href={`/admin?date=${date}${showAll ? "" : "&all=1"}`} className="text-[13px] text-muted underline underline-offset-4">
              {showAll ? "הסתרת לא-משולמות" : "הצגת גם לא-משולמות"}
            </Link>
          }
        >
          {orders.length === 0 ? (
            <p className="py-6 text-center text-muted">אין הזמנות לשישי הזה עדיין.</p>
          ) : (
            <div className="-mx-4 overflow-x-auto sm:-mx-5">
              <table className="w-full min-w-[760px] text-[14px]">
                <thead>
                  <tr className="border-b border-line text-right text-[12px] text-muted">
                    <th className="px-4 py-2 font-medium">#</th>
                    <th className="px-2 py-2 font-medium">לקוח</th>
                    <th className="px-2 py-2 font-medium">פריטים</th>
                    <th className="px-2 py-2 font-medium">קבלה</th>
                    <th className="px-2 py-2 font-medium">סטטוס</th>
                    <th className="px-4 py-2 text-left font-medium">סה״כ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {orders.map((o) => (
                    <tr key={o.id} className="align-top hover:bg-bg">
                      <td className="px-4 py-3">
                        <Link href={`/admin/orders/${o.id}`} className="tabular font-bold underline-offset-4 hover:underline">
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="px-2 py-3">
                        <div className="font-medium">{o.customerName}</div>
                        <a href={`tel:${o.phone}`} className="tabular text-muted" dir="ltr">
                          {o.phone}
                        </a>
                      </td>
                      <td className="px-2 py-3">
                        {o.items.map((i, k) => (
                          <div key={k}>
                            {i.productId === "schnitzel" ? "שניצל" : "זוג חלות"}
                            {i.drink && <span className="text-muted"> · {DRINKS.find((d) => d.id === i.drink)?.label}</span>}
                            <span className="tabular font-bold"> ×{i.quantity}</span>
                          </div>
                        ))}
                      </td>
                      <td className="px-2 py-3">
                        {o.fulfillment === "delivery" ? (
                          <>
                            <div>משלוח</div>
                            <div className="text-muted">
                              {[o.address, o.apartment && `דירה ${o.apartment}`, o.floor && `קומה ${o.floor}`].filter(Boolean).join(", ")}
                            </div>
                          </>
                        ) : (
                          "איסוף"
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <StatusBadge label={STATUS_LABELS[o.status]} tone={statusTone(o)} />
                      </td>
                      <td className="tabular px-4 py-3 text-left font-medium">{formatILS(o.totalAgorot)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}

function Stat({ label, value, sub, big }: { label: string; value: number; sub?: string; big?: boolean }) {
  return (
    <div className="rounded-xl bg-bg px-3 py-3">
      <div className="text-[12px] text-muted">{label}</div>
      <div className={`tabular font-extrabold ${big ? "text-[28px]" : "text-[20px]"}`}>{value}</div>
      {sub && <div className="tabular text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

function NavDate({ date, label, arrow }: { date: string | null; label: string; arrow: string }) {
  if (!date) return <span className="size-9" />;
  return (
    <Link
      href={`/admin?date=${date}`}
      className="grid size-9 place-items-center rounded-full border border-line hover:border-ink"
      aria-label={`${label} (${shortDateHe(date)})`}
    >
      {arrow}
    </Link>
  );
}
