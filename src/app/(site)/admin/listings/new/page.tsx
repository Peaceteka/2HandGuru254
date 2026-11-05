import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { saveListingAction } from "@/server/listing-actions";
import { PageHeader } from "@/components/dashboard-shell";
import { ListingForm } from "@/components/listing-form";

export const metadata: Metadata = { title: "New platform listing" };

export default async function AdminNewListing() {
  await requireAdmin();
  const categories = await db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  return (
    <>
      <PageHeader title="New platform listing" description="Listed and fulfilled by 2ndHandGuru (the platform seller account)." />
      <div className="rounded-xl border bg-white p-5"><ListingForm action={saveListingAction.bind(null, null)} categories={categories} isAdmin /></div>
    </>
  );
}
