import { Suspense } from "react";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getStore } from "@/lib/store";
import { adminFridays, getOrderingCycle } from "@/lib/cycle";
import { longDateHe, weekdayHe } from "@/lib/time";
import { getPaymentProvider } from "@/lib/payments";
import { AdminShell, Label, Panel, StatusBadge, inputCls } from "../ui";
import { ActionForm } from "../forms";
import { saveProduct, saveSettings, setFridayOverride } from "../actions";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted">טוען…</div>}>
      <Settings />
    </Suspense>
  );
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2.5 text-[15px]">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-5 accent-ink" />
      {label}
    </label>
  );
}

function WeekdaySelect({ name, value }: { name: string; value: number }) {
  return (
    <select id={name} name={name} defaultValue={value} className={inputCls}>
      {WEEKDAYS.map((d) => (
        <option key={d} value={d}>
          יום {weekdayHe(d)}
        </option>
      ))}
    </select>
  );
}

async function Settings() {
  await connection();
  await requireAdmin();
  const store = getStore();
  const now = new Date();
  const [settings, products, overrides] = await Promise.all([store.getSettings(), store.getProducts(), store.getOverrides()]);
  const cycle = getOrderingCycle(now, settings, overrides);
  let provider = "לא מוגדר";
  try {
    provider = getPaymentProvider().id === "mock" ? "מצב בדיקה (ללא חיוב)" : getPaymentProvider().id;
  } catch {}
  const messaging = process.env.MESSAGING_PROVIDER === "webhook" && process.env.MESSAGING_WEBHOOK_URL ? "פעיל" : "לא מוגדר";

  return (
    <AdminShell active="settings">
      <h1 className="mb-4 text-[24px] font-extrabold">הגדרות</h1>
      <div className="mb-4 flex flex-wrap gap-2 text-[13px]">
        <StatusBadge label={`תשלומים: ${provider}`} tone={provider === "לא מוגדר" ? "bad" : "muted"} />
        <StatusBadge label={`הודעות אישור: ${messaging}`} tone="muted" />
        <StatusBadge
          label={cycle.open ? `פתוח לשישי ${longDateHe(cycle.fridayDate!)}` : "סגור להזמנות"}
          tone={cycle.open ? "ok" : "bad"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {products.map((p) => (
          <Panel key={p.id} title={p.name}>
            <ActionForm action={saveProduct}>
              <input type="hidden" name="id" value={p.id} />
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label htmlFor={`name-${p.id}`}>שם</Label>
                  <input id={`name-${p.id}`} name="name" defaultValue={p.name} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor={`desc-${p.id}`}>תיאור קצר</Label>
                  <input id={`desc-${p.id}`} name="description" defaultValue={p.description} className={inputCls} />
                </div>
                <div>
                  <Label htmlFor={`price-${p.id}`}>מחיר (₪)</Label>
                  <input id={`price-${p.id}`} name="price" inputMode="decimal" defaultValue={p.priceAgorot / 100} className={inputCls} />
                </div>
                <div>
                  <Label htmlFor={`limit-${p.id}`}>מלאי לשישי (ריק = ללא הגבלה)</Label>
                  <input id={`limit-${p.id}`} name="weeklyLimit" inputMode="numeric" defaultValue={p.weeklyLimit ?? ""} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor={`img-${p.id}`}>תמונה — נתיב ב-public או כתובת https</Label>
                  <input id={`img-${p.id}`} name="image" dir="ltr" defaultValue={p.image} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor={`alt-${p.id}`}>תיאור התמונה (נגישות)</Label>
                  <input id={`alt-${p.id}`} name="imageAlt" defaultValue={p.imageAlt} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <Check name="available" label="זמין להזמנה" defaultChecked={p.available} />
                </div>
              </div>
            </ActionForm>
          </Panel>
        ))}
      </div>

      <div className="mt-4">
        <Panel title="הזמנות, איסוף, משלוח וביטולים">
          <ActionForm action={saveSettings}>
            <div className="grid gap-6 lg:grid-cols-2">
              <fieldset className="space-y-3">
                <legend className="mb-2 font-bold">כללי</legend>
                <Check name="orderingOpen" label="ההזמנות פתוחות (מתג ראשי)" defaultChecked={settings.orderingOpen} />
                <div>
                  <Label htmlFor="brandName">שם העסק (מופיע בראש האתר)</Label>
                  <input id="brandName" name="brandName" defaultValue={settings.brandName} className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cutoffWeekday">סגירת הזמנות — יום</Label>
                    <WeekdaySelect name="cutoffWeekday" value={settings.cutoffWeekday} />
                  </div>
                  <div>
                    <Label htmlFor="cutoffTime">שעה</Label>
                    <input id="cutoffTime" name="cutoffTime" type="time" defaultValue={settings.cutoffTime} className={inputCls} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="weeksAhead">כמה שבועות קדימה לאפשר כששישי סגור</Label>
                  <input id="weeksAhead" name="weeksAhead" type="number" min={1} max={6} defaultValue={settings.weeksAhead} className={inputCls} />
                </div>
                <div>
                  <Label htmlFor="supportPhone">טלפון לשאלות (מוצג ללקוח)</Label>
                  <input id="supportPhone" name="supportPhone" type="tel" dir="ltr" defaultValue={settings.supportPhone} className={inputCls} />
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="mb-2 font-bold">איסוף עצמי</legend>
                <Check name="pickupEnabled" label="איסוף עצמי זמין" defaultChecked={settings.pickup.enabled} />
                <div>
                  <Label htmlFor="pickupLocation">מקום האיסוף</Label>
                  <input id="pickupLocation" name="pickupLocation" defaultValue={settings.pickup.locationText} className={inputCls} />
                </div>
                <div>
                  <Label htmlFor="pickupHours">שעות איסוף</Label>
                  <input id="pickupHours" name="pickupHours" defaultValue={settings.pickup.hoursText} className={inputCls} />
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="mb-2 font-bold">משלוח</legend>
                <Check name="deliveryEnabled" label="משלוח זמין" defaultChecked={settings.delivery.enabled} />
                <div>
                  <Label htmlFor="deliveryFee">דמי משלוח להזמנה (₪)</Label>
                  <input id="deliveryFee" name="deliveryFee" inputMode="decimal" defaultValue={settings.delivery.feeAgorot / 100} className={inputCls} />
                </div>
                <div>
                  <Label htmlFor="deliveryAddresses">כתובות מורשות למשלוח — שורה לכל כתובת</Label>
                  <textarea
                    id="deliveryAddresses"
                    name="deliveryAddresses"
                    rows={3}
                    defaultValue={settings.delivery.addresses.join("\n")}
                    className="w-full rounded-lg border border-line bg-card p-3 text-[15px] focus:border-ink focus:outline-none"
                  />
                  <p className="mt-1 text-[12px] text-muted">הלקוח יכול לבחור רק מהרשימה. בלי כתובות — המשלוח לא יוצג.</p>
                </div>
                <div>
                  <Label htmlFor="deliveryHours">שעות משלוח</Label>
                  <input id="deliveryHours" name="deliveryHours" defaultValue={settings.delivery.hoursText} className={inputCls} />
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="mb-2 font-bold">מדיניות ביטול</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="freeUntilWeekday">ביטול חינם עד — יום</Label>
                    <WeekdaySelect name="freeUntilWeekday" value={settings.cancellation.freeUntilWeekday} />
                  </div>
                  <div>
                    <Label htmlFor="freeUntilTime">שעה</Label>
                    <input id="freeUntilTime" name="freeUntilTime" type="time" defaultValue={settings.cancellation.freeUntilTime} className={inputCls} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="lateFeePercent">דמי ביטול מאוחר (%)</Label>
                  <input id="lateFeePercent" name="lateFeePercent" inputMode="numeric" defaultValue={settings.cancellation.lateFeePercent} className={inputCls} />
                </div>
                <Check
                  name="lateFeeApproved"
                  label="המדיניות נבדקה משפטית — להפעיל דמי ביטול מאוחר"
                  defaultChecked={settings.cancellation.lateFeeApproved}
                />
                <div>
                  <Label htmlFor="policyText">נוסח המדיניות שמוצג לפני תשלום</Label>
                  <textarea
                    id="policyText"
                    name="policyText"
                    rows={4}
                    defaultValue={settings.cancellation.policyText}
                    className="w-full rounded-lg border border-line bg-card p-3 text-[15px] focus:border-ink focus:outline-none"
                  />
                </div>
              </fieldset>
            </div>
          </ActionForm>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="סגירת שישי מסוים">
          <ul className="divide-y divide-line">
            {adminFridays(now, 0, 6).map((d) => {
              const closed = overrides.some((o) => o.date === d && o.closed);
              return (
                <li key={d} className="flex items-center justify-between py-2 text-[15px]">
                  <span>
                    {longDateHe(d)} {closed && <StatusBadge label="סגור" tone="bad" />}
                  </span>
                  <form action={setFridayOverride}>
                    <input type="hidden" name="date" value={d} />
                    <input type="hidden" name="mode" value={closed ? "open" : "close"} />
                    <button className="rounded-full border border-line px-3 py-1 text-[13px] hover:border-ink">{closed ? "פתיחה" : "סגירה"}</button>
                  </form>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </AdminShell>
  );
}
