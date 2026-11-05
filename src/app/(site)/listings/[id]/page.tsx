import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Tag, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { fileUrl } from "@/lib/storage";
import { formatKES, formatDate, formatMonthYear, timeAgo } from "@/lib/format";
import { CONDITION_LABELS } from "@/lib/constants";
import { Gallery } from "@/components/gallery";
import { SaveButton } from "@/components/save-button";
import { BuyerProtection } from "@/components/buyer-protection";
import { VerifiedBadge, EscrowBadge } from "@/components/badges";
import { ListingCard, listingCardSelect } from "@/components/listing-card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function load(id: string) {
  return db.listing.findUnique({
    where: { id },
    include: {
      images: { orderBy: { position: "asc" } },
      category: true,
      seller: { select: { id: true, name: true, createdAt: true, sellerProfile: { select: { status: true, businessName: true, isPlatform: true, county: true } } } },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const l = await load((await params).id);
  return l ? { title: l.title, description: l.description.slice(0, 150) } : { title: "Listing not found" };
}

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [listing, user, settings] = await Promise.all([load(id), getCurrentUser(), getSettings()]);
  const isOwner = !!user && listing?.sellerId === user.id;
  const visible = listing && (["ACTIVE", "RESERVED", "SOLD"].includes(listing.status) || isOwner || user?.role === "ADMIN");
  if (!listing || !visible) notFound();

  const verified = listing.seller.sellerProfile?.status === "APPROVED";
  const sellerName = listing.seller.sellerProfile?.businessName || listing.seller.name;
  const saved = user ? !!(await db.savedItem.findUnique({ where: { userId_listingId: { userId: user.id, listingId: id } } })) : false;
  const more = await db.listing.findMany({
    where: { status: "ACTIVE", categoryId: listing.categoryId, id: { not: id } },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: listingCardSelect,
  });

  return (
    <div className="container-page py-6 sm:py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href="/listings" className="hover:underline">Listings</Link> /{" "}
        <Link href={`/listings?category=${listing.category.slug}`} className="hover:underline">{listing.category.name}</Link>
      </nav>
      {listing.status !== "ACTIVE" && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {listing.status === "RESERVED" ? "This item is reserved — a buyer has paid into escrow." : listing.status === "SOLD" ? "This item has been sold." : `This listing is ${listing.status.toLowerCase()} and not visible to the public.`}
        </p>
      )}
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <Gallery images={listing.images.map((i) => fileUrl(i.key))} title={listing.title} />
          <section className="mt-6 rounded-xl border bg-white p-5" aria-labelledby="desc-h">
            <h2 id="desc-h" className="mb-2 font-semibold">Description</h2>
            <p className="whitespace-pre-line text-neutral-700">{listing.description}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-muted-foreground">Condition</dt><dd className="font-medium">{CONDITION_LABELS[listing.condition]}</dd></div>
              <div><dt className="text-muted-foreground">Category</dt><dd className="font-medium">{listing.category.name}</dd></div>
              <div><dt className="text-muted-foreground">Posted</dt><dd className="font-medium">{formatDate(listing.createdAt)}</dd></div>
            </dl>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-white p-5">
            <h1 className="text-xl font-semibold leading-snug">{listing.title}</h1>
            <p className="mt-2 text-3xl font-bold text-brand-black">{formatKES(listing.price)}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600">
              <span className="inline-flex items-center gap-1"><Tag className="size-4" aria-hidden />{CONDITION_LABELS[listing.condition]}</span>
              <span className="inline-flex items-center gap-1"><MapPin className="size-4" aria-hidden />{listing.town ? `${listing.town}, ` : ""}{listing.county}</span>
              <span className="inline-flex items-center gap-1"><Clock className="size-4" aria-hidden />{timeAgo(listing.createdAt)}</span>
            </div>
            <div className="mt-4"><EscrowBadge /></div>
            <div className="mt-5 flex flex-col gap-2">
              {listing.status === "ACTIVE" && !isOwner ? (
                <Button asChild size="lg" className="w-full"><Link href={`/checkout/${listing.id}`}>Buy with Escrow</Link></Button>
              ) : isOwner ? (
                <Button asChild variant="outline" className="w-full"><Link href={`/seller/listings/${listing.id}/edit`}>Edit listing</Link></Button>
              ) : null}
              {!isOwner && <SaveButton listingId={listing.id} initialSaved={saved} />}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Seller</p>
            <Link href={`/sellers/${listing.seller.id}`} className="mt-1 block text-lg font-semibold hover:underline">{sellerName}</Link>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
              {verified && <VerifiedBadge />}
              <span>Member since {formatMonthYear(listing.seller.createdAt)}</span>
            </div>
            <p className="mt-3 text-xs text-neutral-600">Contact details are shared after payment is secured in escrow. Never pay a seller directly.</p>
          </div>

          <BuyerProtection autoReleaseDays={settings.autoReleaseDays} dispatchHours={settings.dispatchWindowHours} />
        </aside>
      </div>

      {more.length > 0 && (
        <section className="mt-12" aria-labelledby="more-h">
          <h2 id="more-h" className="mb-4 text-xl font-semibold">More in {listing.category.name}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{more.map((l) => <ListingCard key={l.id} listing={l} />)}</div>
        </section>
      )}
    </div>
  );
}
