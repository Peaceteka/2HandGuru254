import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireApprovedSeller } from "@/lib/session";
import { fileUrl } from "@/lib/storage";
import { formatKES, formatDate } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/dashboard-shell";
import { ListingStatusBadge } from "@/components/badges";
import { ListingRowActions } from "@/components/listing-row-actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "My listings" };

export default async function SellerListings({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireApprovedSeller();
  const { status } = await searchParams;
  const listings = await db.listing.findMany({
    where: { sellerId: user.id, ...(status ? { status: status as never } : {}) },
    orderBy: { updatedAt: "desc" },
    include: { images: { orderBy: { position: "asc" }, take: 1 }, category: { select: { name: true } } },
  });
  const tabs = [["", "All"], ["ACTIVE", "Active"], ["DRAFT", "Drafts"], ["RESERVED", "Reserved"], ["SOLD", "Sold"], ["HIDDEN", "Hidden"]];
  return (
    <>
      <PageHeader title="Listings" action={<Button asChild><Link href="/seller/listings/new">New listing</Link></Button>} />
      <nav aria-label="Filter by status" className="mb-4 flex gap-1 overflow-x-auto">
        {tabs.map(([v, l]) => (
          <Link key={v} href={v ? `/seller/listings?status=${v}` : "/seller/listings"} aria-current={(status ?? "") === v ? "page" : undefined}
            className="rounded-full border px-3 py-1 text-sm whitespace-nowrap aria-[current=page]:border-brand-black aria-[current=page]:bg-brand-black aria-[current=page]:text-white">
            {l}
          </Link>
        ))}
      </nav>
      {listings.length ? (
        <ul className="divide-y rounded-xl border bg-white">
          {listings.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="size-14 shrink-0 overflow-hidden rounded-lg border bg-neutral-100">
                {l.images[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(l.images[0].key)} alt="" className="size-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/listings/${l.id}`} className="block truncate font-medium hover:underline">{l.title}</Link>
                <p className="text-xs text-muted-foreground">{l.category.name} · {formatKES(l.price)} · updated {formatDate(l.updatedAt)}</p>
                {l.moderationNote && <p className="text-xs text-red-700">Moderator note: {l.moderationNote}</p>}
              </div>
              <ListingStatusBadge status={l.status} />
              <ListingRowActions id={l.id} canEdit={!["RESERVED", "REMOVED"].includes(l.status)} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No listings here" description="Post your first item — it only takes a minute." action={<Button asChild><Link href="/seller/listings/new">New listing</Link></Button>} />
      )}
    </>
  );
}
