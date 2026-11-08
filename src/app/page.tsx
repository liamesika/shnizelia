import { Suspense } from "react";
import { connection } from "next/server";
import { loadStorefront } from "@/lib/orders";
import { toPublicConfig } from "@/lib/public-config";
import { Storefront } from "@/components/storefront";

export default function HomePage(props: PageProps<"/">) {
  return (
    <Suspense fallback={<StorefrontSkeleton />}>
      <StorefrontData searchParams={props.searchParams} />
    </Suspense>
  );
}

async function StorefrontData({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  await connection();
  const [data, sp] = await Promise.all([loadStorefront(), searchParams]);
  return <Storefront config={toPublicConfig(data)} openCart={sp.cart === "1"} />;
}

function StorefrontSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8" aria-busy="true" aria-label="טוען">
      <div className="h-16" />
      <div className="h-[132px] w-72 bg-sesame sm:h-[214px] sm:w-[560px]" />
      <div className="mt-6 h-10 w-64 bg-sesame" />
      <div className="mt-6 h-28 bg-sesame sm:h-44" />
    </div>
  );
}
