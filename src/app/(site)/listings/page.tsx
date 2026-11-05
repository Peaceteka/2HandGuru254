import type { Metadata } from "next";
import Link from "next/link";
import type { ListingCondition, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { CONDITION_LABELS, PAGE_SIZE } from "@/lib/constants";
import { ListingCard, listingCardSelect } from "@/components/listing-card";
import { SearchFilters, type BrowseParams } from "@/components/search-filters";
import { Pagination } from "@/components/pagination";

export const metadata: Metadata = { title: "Browse listings" };
export const dynamic = "force-dynamic";

const toInt = (v?: string) => {
  const n = Number(v);
  return v && Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
};

export default async function BrowsePage({ searchParams }: { searchParams: Promise<BrowseParams & { page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, toInt(sp.page) ?? 1);
  const q = sp.q?.trim().slice(0, 100);
  const min = toInt(sp.min);
  const max = toInt(sp.max);
  const condition = sp.condition && sp.condition in CONDITION_LABELS ? (sp.condition as ListingCondition) : undefined;

  const where: Prisma.ListingWhereInput = {
    status: "ACTIVE",
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {}),
    ...(sp.category ? { category: { slug: sp.category } } : {}),
    ...(condition ? { condition } : {}),
    ...(sp.county ? { county: sp.county } : {}),
    ...(min !== undefined || max !== undefined ? { price: { gte: min, lte: max } } : {}),
  };
  const orderBy: Prisma.ListingOrderByWithRelationInput =
    sp.sort === "price_asc" ? { price: "asc" } : sp.sort === "price_desc" ? { price: "desc" } : { createdAt: "desc" };

  const [categories, total, listings] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { slug: true, name: true } }),
    db.listing.count({ where }),
    db.listing.findMany({ where, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: listingCardSelect }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const catName = categories.find((c) => c.slug === sp.category)?.name;
  const makeHref = (p: number) => {
    const u = new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `/listings?${u}`;
  };

  return (
    <div className="container-page py-6 sm:py-8">
      <h1 className="text-2xl font-semibold">{q ? `Results for “${q}”` : catName ?? "All listings"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{total.toLocaleString()} item{total === 1 ? "" : "s"}{sp.county ? ` in ${sp.county}` : " across Kenya"}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside>
          <details className="rounded-xl border bg-white p-4 lg:hidden">
            <summary className="cursor-pointer font-medium">Filters & sort</summary>
            <div className="mt-4"><SearchFilters params={sp} categories={categories} /></div>
          </details>
          <div className="hidden rounded-xl border bg-white p-4 lg:block"><SearchFilters params={sp} categories={categories} /></div>
        </aside>
        <div>
          {listings.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-white p-10 text-center">
              <p className="font-medium">No items match your filters.</p>
              <Link href="/listings" className="mt-2 inline-block text-sm text-brand-blue hover:underline">Clear filters</Link>
            </div>
          )}
          <div className="mt-8"><Pagination page={page} totalPages={totalPages} makeHref={makeHref} /></div>
        </div>
      </div>
    </div>
  );
}
