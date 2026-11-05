import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { fileUrl } from "@/lib/storage";
import { formatKES } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { CONDITION_LABELS } from "@/lib/constants";
import { CheckoutForm } from "@/components/checkout-form";
import { BuyerProtection } from "@/components/buyer-protection";
import { VerifiedBadge } from "@/components/badges";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const user = await requireUser(`/checkout/${listingId}`);
  const [listing, settings] = await Promise.all([
    db.listing.findUnique({
      where: { id: listingId },
      include: { images: { orderBy: { position: "asc" }, take: 1 }, seller: { select: { name: true, sellerProfile: { select: { businessName: true, status: true } } } } },
    }),
    getSettings(),
  ]);
  if (!listing) notFound();
  if (listing.sellerId === user.id) redirect(`/listings/${listingId}`);
  const pending = await db.order.findFirst({ where: { listingId, buyerId: user.id, status: "PENDING_PAYMENT" }, select: { id: true } });
  if (pending) redirect(`/account/orders/${pending.id}`);

  return (
    <div className="container-page py-6 sm:py-10">
      <h1 className="text-2xl font-semibold">Checkout</h1>
      {listing.status !== "ACTIVE" ? (
        <div className="mt-6 rounded-xl border bg-white p-6">
          <p className="font-medium">This item is no longer available.</p>
          <Link href="/listings" className="mt-2 inline-block text-brand-blue hover:underline">Find something similar</Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-xl border bg-white p-5 sm:p-6" aria-labelledby="delivery-h">
            <h2 id="delivery-h" className="mb-4 font-semibold">Payment & delivery</h2>
            <CheckoutForm listingId={listing.id} phone={displayPhone(user.phone)} county={user.county} amountLabel={formatKES(listing.price)} />
          </section>
          <aside className="space-y-4">
            <div className="rounded-xl border bg-white p-5">
              <div className="flex gap-3">
                {listing.images[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(listing.images[0].key)} alt="" className="size-20 rounded-lg border object-cover" />
                )}
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{listing.title}</p>
                  <p className="text-sm text-neutral-600">{CONDITION_LABELS[listing.condition]} · {listing.county}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm">{listing.seller.sellerProfile?.businessName || listing.seller.name}{listing.seller.sellerProfile?.status === "APPROVED" && <VerifiedBadge />}</p>
                </div>
              </div>
              <dl className="mt-4 space-y-1 border-t pt-4 text-sm">
                <div className="flex justify-between"><dt>Item price</dt><dd>{formatKES(listing.price)}</dd></div>
                <div className="flex justify-between"><dt>Buyer fee</dt><dd>KES 0</dd></div>
                <div className="flex justify-between pt-1 text-base font-semibold"><dt>Total</dt><dd>{formatKES(listing.price)}</dd></div>
              </dl>
              <p className="mt-2 text-xs text-neutral-500">Delivery costs are agreed with the seller and are not collected through escrow.</p>
            </div>
            <BuyerProtection autoReleaseDays={settings.autoReleaseDays} dispatchHours={settings.dispatchWindowHours} />
          </aside>
        </div>
      )}
    </div>
  );
}
