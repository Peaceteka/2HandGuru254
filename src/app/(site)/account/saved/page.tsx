import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/dashboard-shell";
import { ListingCard, listingCardSelect } from "@/components/listing-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Saved items" };

export default async function SavedPage() {
  const user = await requireUser("/account/saved");
  const saved = await db.savedItem.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { listing: { select: { ...listingCardSelect, status: true } } } });
  return (
    <>
      <PageHeader title="Saved items" description="Items you've saved for later." />
      {saved.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {saved.map((s) => (
            <div key={s.id} className="relative">
              <ListingCard listing={s.listing} />
              {s.listing.status !== "ACTIVE" && <span className="absolute top-2 left-2 rounded bg-black/80 px-2 py-0.5 text-xs text-white">No longer available</span>}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Nothing saved yet" description="Tap “Save” on any listing to keep track of it." action={<Button asChild><Link href="/listings">Browse listings</Link></Button>} />
      )}
    </>
  );
}
