import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { formatMonthYear } from "@/lib/format";
import { VerifiedBadge } from "@/components/badges";
import { ListingCard, listingCardSelect } from "@/components/listing-card";

export const dynamic = "force-dynamic";

async function load(id: string) {
  return db.user.findFirst({
    where: { id, status: "ACTIVE", sellerProfile: { status: "APPROVED" } },
    select: {
      id: true, name: true, createdAt: true,
      sellerProfile: { select: { businessName: true, county: true, town: true, description: true, isPlatform: true } },
      _count: { select: { sellerOrders: { where: { status: "RELEASED" } } } },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const s = await load((await params).id);
  return { title: s ? s.sellerProfile?.businessName || s.name : "Seller not found" };
}

export default async function SellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seller = await load(id);
  if (!seller?.sellerProfile) notFound();
  const listings = await db.listing.findMany({ where: { sellerId: id, status: "ACTIVE" }, orderBy: { createdAt: "desc" }, select: listingCardSelect });
  const p = seller.sellerProfile;

  return (
    <div className="container-page py-6 sm:py-8">
      <header className="rounded-xl border bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div aria-hidden className="grid size-14 place-items-center rounded-full bg-brand-yellow text-xl font-bold text-brand-black">
            {(p.businessName || seller.name).charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{p.businessName || seller.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-600">
              <VerifiedBadge />
              <span className="inline-flex items-center gap-1"><MapPin className="size-4" aria-hidden />{p.town ? `${p.town}, ` : ""}{p.county}</span>
              <span>Member since {formatMonthYear(seller.createdAt)}</span>
              <span>{seller._count.sellerOrders} completed sale{seller._count.sellerOrders === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>
        {p.description && <p className="mt-4 max-w-3xl whitespace-pre-line text-neutral-700">{p.description}</p>}
      </header>
      <h2 className="mt-8 mb-4 text-xl font-semibold">Listings ({listings.length})</h2>
      {listings.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{listings.map((l) => <ListingCard key={l.id} listing={l} />)}</div>
      ) : (
        <p className="text-muted-foreground">This seller has no active listings right now.</p>
      )}
    </div>
  );
}
