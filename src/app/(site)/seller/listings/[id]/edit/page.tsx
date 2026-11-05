import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireApprovedSeller } from "@/lib/session";
import { loadListingForEdit } from "@/lib/listing-queries";
import { saveListingAction } from "@/server/listing-actions";
import { PageHeader } from "@/components/dashboard-shell";
import { ListingForm } from "@/components/listing-form";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireApprovedSeller();
  const [listing, categories] = await Promise.all([
    loadListingForEdit(id),
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  if (!listing || listing.sellerId !== user.id) notFound();
  const locked = listing.status === "RESERVED" || listing.status === "REMOVED";
  return (
    <>
      <PageHeader title="Edit listing" />
      {locked ? (
        <p className="rounded-xl border bg-white p-5 text-sm">This listing is {listing.status.toLowerCase()} and can&apos;t be edited.</p>
      ) : (
        <div className="rounded-xl border bg-white p-5"><ListingForm action={saveListingAction.bind(null, listing.id)} categories={categories} listing={listing} /></div>
      )}
    </>
  );
}
