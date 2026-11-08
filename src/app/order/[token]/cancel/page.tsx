import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getStore } from "@/lib/store";
import { customerRequestCancellation } from "@/lib/orders";
import { quoteCancellation } from "@/lib/cancellation";
import { formatDateTimeHe } from "@/lib/time";

export const metadata: Metadata = { title: "ביטול הזמנה", referrer: "no-referrer" };

async function requestCancel(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const result = await customerRequestCancellation(token, String(formData.get("reason") ?? ""));
  if (!result.ok) redirect(`/order/${token}/cancel?error=1`);
  redirect(`/order/${token}`);
}

export default function CancelPage(props: PageProps<"/order/[token]/cancel">) {
  return (
    <main className="mx-auto max-w-md px-5 pt-10 pb-16">
      <Suspense fallback={<div className="h-64 bg-sesame" aria-busy="true" />}>
        <CancelData {...props} />
      </Suspense>
    </main>
  );
}

async function CancelData({ params, searchParams }: PageProps<"/order/[token]/cancel">) {
  await connection();
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const store = getStore();
  const [order, settings] = await Promise.all([store.getOrderByToken(token), store.getSettings()]);
  if (!order) notFound();
  if (!["paid", "preparing", "ready"].includes(order.status)) redirect(`/order/${token}`);

  const quote = quoteCancellation(order, settings, new Date());
  const message =
    quote.window === "free"
      ? `הביטול ללא עלות (עד ${formatDateTimeHe(quote.freeUntil)}). ההחזר המלא יבוצע לאמצעי התשלום.`
      : quote.window === "after_fulfillment"
        ? "מועד ההזמנה כבר עבר. נבדוק את הבקשה ונחזור אליכם."
        : "מועד הביטול ללא עלות עבר. נבדוק את הבקשה בהתאם למדיניות שאישרתם ונחזור אליכם.";

  return (
    <div>
      <h1 className="font-display text-[34px] leading-none">ביטול הזמנה {order.orderNumber}</h1>
      <p className="mt-2 text-[15px]">{message}</p>
      <p className="mt-3 bg-sesame p-3 text-[14px] leading-relaxed text-muted">{order.policySnapshot}</p>
      {sp.error && (
        <p role="alert" className="mt-3 text-[14px] text-danger">
          לא ניתן לבטל את ההזמנה אונליין. {settings.supportPhone ? `אפשר להתקשר: ${settings.supportPhone}` : "צרו איתנו קשר."}
        </p>
      )}
      <form action={requestCancel} className="mt-5 space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <label htmlFor="reason" className="mb-1 block text-[14px] font-medium">
            סיבה <span className="font-normal text-muted">(לא חובה)</span>
          </label>
          <textarea id="reason" name="reason" maxLength={300} rows={3} className="w-full border-2 border-line bg-card p-3 text-[16px] focus:border-zaatar focus:outline-none" />
        </div>
        <button type="submit" className="h-14 w-full border-2 border-ink text-[16px] font-semibold transition-colors hover:bg-ink hover:text-white">
          שליחת בקשת ביטול
        </button>
        <Link href={`/order/${token}`} className="block text-center text-[14px] text-muted underline underline-offset-4">
          חזרה להזמנה
        </Link>
      </form>
    </div>
  );
}
