import { after } from "next/server";
import { getPaymentProvider } from "@/lib/payments";
import { applyPaymentEvent } from "@/lib/orders";
import { siteOrigin } from "@/lib/site";

/** Server-to-server payment notifications. This is what marks an order as paid. */
export async function POST(request: Request, ctx: RouteContext<"/api/payments/webhook/[provider]">) {
  const { provider: providerId } = await ctx.params;
  let provider;
  try {
    provider = getPaymentProvider(providerId);
  } catch {
    return new Response("unknown provider", { status: 404 });
  }
  const event = await provider.verifyWebhook(request);
  if (!event) return new Response("unauthorized", { status: 401 });

  const result = await applyPaymentEvent(event, await siteOrigin(), (task) => after(task));
  return Response.json(result);
}
