import { Suspense } from "react";
import { connection, after } from "next/server";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/store";
import { mockAllowed } from "@/lib/payments";
import { mockProvider, signMock } from "@/lib/payments/mock";
import { applyPaymentEvent } from "@/lib/orders";
import { siteOrigin } from "@/lib/site";
import { formatILS } from "@/lib/money";

/** DEV ONLY — stands in for the payment company's hosted page. */
async function simulate(formData: FormData) {
  "use server";
  if (!mockAllowed()) throw new Error("Mock payments disabled");
  const orderId = String(formData.get("orderId"));
  const outcome = formData.get("outcome") === "fail" ? "failed" : "paid";
  const order = await getStore().getOrder(orderId);
  if (!order) throw new Error("Order not found");

  // Build a signed webhook and run it through the same verification path as production.
  const body = JSON.stringify({ orderId, providerRef: order.paymentRef, amountAgorot: order.totalAgorot, outcome });
  const request = new Request("http://internal/webhook", {
    method: "POST",
    body,
    headers: { "x-mock-signature": signMock(body) },
  });
  const event = await mockProvider.verifyWebhook(request);
  if (!event) throw new Error("Signature check failed");
  await applyPaymentEvent(event, await siteOrigin(), (task) => after(task));
  redirect(`/order/${order.publicToken}`);
}

export default function MockPayPage(props: PageProps<"/pay/mock/[orderId]">) {
  return (
    <main className="mx-auto max-w-sm px-5 pt-16">
      <Suspense>
        <MockPay params={props.params} />
      </Suspense>
    </main>
  );
}

async function MockPay({ params }: { params: PageProps<"/pay/mock/[orderId]">["params"] }) {
  await connection();
  if (!mockAllowed()) notFound();
  const { orderId } = await params;
  const order = await getStore().getOrder(orderId);
  if (!order) notFound();
  if (order.status !== "pending_payment" && order.status !== "payment_failed") redirect(`/order/${order.publicToken}`);

  return (
    <div className="border-2 border-dashed border-crust bg-card p-6 text-center">
      <p className="text-[13px] font-medium text-accent">סביבת בדיקה · לא מתבצע חיוב</p>
      <h1 className="mt-2 text-[22px] font-bold">עמוד תשלום לדוגמה</h1>
      <p className="tabular mt-1 text-[28px] font-extrabold">{formatILS(order.totalAgorot)}</p>
      <p className="text-[13px] text-muted">הזמנה {order.orderNumber}</p>
      <form action={simulate} className="mt-6 space-y-2">
        <input type="hidden" name="orderId" value={order.id} />
        <button name="outcome" value="ok" className="h-14 w-full bg-zaatar font-semibold text-white">
          תשלום מוצלח
        </button>
        <button name="outcome" value="fail" className="h-14 w-full border-2 border-line">
          תשלום נכשל
        </button>
      </form>
    </div>
  );
}
