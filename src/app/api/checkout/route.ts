import { createCheckout, type CheckoutInput } from "@/lib/orders";
import { siteOrigin } from "@/lib/site";

export async function POST(request: Request) {
  let body: CheckoutInput;
  try {
    body = (await request.json()) as CheckoutInput;
  } catch {
    return Response.json({ ok: false, code: "bad_request", message: "בקשה לא תקינה" }, { status: 400 });
  }
  try {
    const result = await createCheckout(body, await siteOrigin());
    return Response.json(result, { status: result.ok ? 200 : 422 });
  } catch (err) {
    console.error("[checkout]", err);
    return Response.json({ ok: false, code: "server", message: "משהו השתבש אצלנו. לא חויבתם — נסו שוב בעוד רגע." }, { status: 500 });
  }
}
