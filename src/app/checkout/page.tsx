import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { loadStorefront } from "@/lib/orders";
import { toPublicConfig } from "@/lib/public-config";
import { CheckoutForm } from "@/components/checkout-form";

export const metadata: Metadata = { title: "סיום הזמנה" };

export default function CheckoutPage(props: PageProps<"/checkout">) {
  return (
    <div className="mx-auto max-w-md px-5">
      <header className="flex h-14 items-center">
        <Link href="/" className="-m-2 flex items-center gap-1.5 p-2 text-[15px] font-medium text-muted hover:text-ink">
          <span aria-hidden="true">→</span> חזרה
        </Link>
      </header>
      <h1 className="mb-3 font-display text-[40px] leading-[1.05]">סיום הזמנה</h1>
      <Suspense fallback={<div className="mt-4 h-96 bg-sesame" aria-busy="true" />}>
        <CheckoutData searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function CheckoutData({ searchParams }: { searchParams: PageProps<"/checkout">["searchParams"] }) {
  await connection();
  const [data, sp] = await Promise.all([loadStorefront(), searchParams]);
  return <CheckoutForm config={toPublicConfig(data)} paymentCancelled={sp.payment === "cancelled"} />;
}
