import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { loadListingForEdit } from "@/lib/listing-queries";
import { saveListingAction } from "@/server/listing-actions";
import { PageHeader } from "@/components/dashboard-shell";
import { ListingForm } from "@/components/listing-form";

export const metadata: Metadata = { title: "Edit platform listing" };

export default async function AdminEditListing({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [listing, categories] = await Promise.all([loadListingForEdit(id), db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } })]);
  if (!listing) notFound();
  return (
    <>
      <PageHeader title="Edit listing" />
      <div className="rounded-xl border bg-white p-5"><ListingForm action={saveListingAction.bind(null, listing.id)} categories={categories} listing={listing} isAdmin /></div>
    </>
  );
}
