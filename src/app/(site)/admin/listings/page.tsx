import type { Metadata } from "next";
import Link from "next/link";
import type { ListingStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatKES, formatDate } from "@/lib/format";
import { moderateListingAction } from "@/server/admin-actions";
import { PageHeader } from "@/components/dashboard-shell";
import { ListingStatusBadge } from "@/components/badges";
import { FeatureToggle, ReasonForm } from "@/components/admin-ui";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Moderate listings" };
const PER = 25;
const STATUSES = ["ACTIVE", "DRAFT", "RESERVED", "SOLD", "HIDDEN", "REMOVED"];

export default async function AdminListings({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.ListingWhereInput = {
    ...(sp.q ? { title: { contains: sp.q, mode: "insensitive" } } : {}),
    ...(sp.status && STATUSES.includes(sp.status) ? { status: sp.status as ListingStatus } : {}),
  };
  const [total, listings] = await Promise.all([
    db.listing.count({ where }),
    db.listing.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER, include: { seller: { select: { name: true, sellerProfile: { select: { isPlatform: true } } } }, category: { select: { name: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Listings" description={`${total} listings`} action={<Button asChild><Link href="/admin/listings/new">New platform listing</Link></Button>} />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <Input name="q" defaultValue={sp.q} placeholder="Search title" className="max-w-xs" aria-label="Search title" />
        <select name="status" defaultValue={sp.status ?? ""} className="h-10 rounded-lg border px-3 text-sm" aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
        </select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>
      <ul className="divide-y rounded-xl border bg-white">
        {listings.map((l) => {
          const platform = l.seller.sellerProfile?.isPlatform;
          const locked = l.status === "RESERVED" || l.status === "SOLD";
          return (
            <li key={l.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <Link href={`/listings/${l.id}`} className="font-medium hover:underline">{l.title}</Link>{l.featured && <span className="ml-2 rounded bg-brand-yellow px-1.5 py-0.5 text-xs">featured</span>}
                <p className="text-xs text-muted-foreground">{formatKES(l.price)} · {l.category.name} · {platform ? "Platform listing" : l.seller.name} · {formatDate(l.createdAt)}</p>
                {l.moderationNote && <p className="text-xs text-red-700">Note: {l.moderationNote}</p>}
                <div className="mt-1"><ListingStatusBadge status={l.status} /></div>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                {l.status === "ACTIVE" && <FeatureToggle id={l.id} featured={l.featured} />}
                {platform && !locked && <Button asChild size="sm" variant="outline"><Link href={`/admin/listings/${l.id}/edit`}>Edit</Link></Button>}
                {!locked && (l.status === "HIDDEN" || l.status === "REMOVED") && (
                  <ReasonForm action={moderateListingAction.bind(null, l.id, "ACTIVE")} label="Restore" variant="outline" required={false} />
                )}
                {!locked && l.status !== "HIDDEN" && l.status !== "REMOVED" && (
                  <details className="w-64"><summary className="cursor-pointer text-sm text-red-700">Moderate…</summary>
                    <div className="mt-2 space-y-3">
                      <ReasonForm action={moderateListingAction.bind(null, l.id, "HIDDEN")} label="Hide" variant="outline" required={false} />
                      <ReasonForm action={moderateListingAction.bind(null, l.id, "REMOVED")} label="Remove" variant="destructive" required={false} confirm="Remove this listing? The seller can't edit it afterwards." />
                    </div>
                  </details>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4"><Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PER))} makeHref={(p) => `/admin/listings?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(p) })}`} /></div>
    </>
  );
}
