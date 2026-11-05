import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireApprovedSeller } from "@/lib/session";
import { saveListingAction } from "@/server/listing-actions";
import { PageHeader } from "@/components/dashboard-shell";
import { ListingForm } from "@/components/listing-form";

export const metadata: Metadata = { title: "New listing" };

export default async function NewListing() {
  await requireApprovedSeller();
  const categories = await db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  return (
    <>
      <PageHeader title="New listing" />
      <div className="rounded-xl border bg-white p-5"><ListingForm action={saveListingAction.bind(null, null)} categories={categories} /></div>
    </>
  );
}
