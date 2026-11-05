import Image from "next/image";
import Link from "next/link";
import { Search, ShieldCheck, BadgeCheck, Wallet, PlusCircle, LogIn } from "lucide-react";
import { getCurrentUser, sellHrefFor } from "@/lib/session";
import { db } from "@/lib/db";
import { ListingCard, listingCardSelect } from "@/components/listing-card";
import { CategoryIcon } from "@/components/category-icon";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const sellHref = sellHrefFor(user);
  const [categories, featured, latest] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { listings: { where: { status: "ACTIVE" } } } } } }),
    db.listing.findMany({ where: { status: "ACTIVE", featured: true }, orderBy: { createdAt: "desc" }, take: 8, select: listingCardSelect }),
    db.listing.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 12, select: listingCardSelect }),
  ]);

  return (
    <>
      <section className="border-b bg-gradient-to-b from-brand-yellow/15 to-white">
        <div className="container-page flex flex-col items-center py-10 text-center sm:py-14">
          <Image src="/logo.webp" alt="2nd Hand Guru 254" width={176} height={176} priority className="size-32 rounded-full shadow-md sm:size-44" />
          <p className="mt-6 mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-blue-soft px-3 py-1 text-xs font-medium text-brand-blue">
            <ShieldCheck className="size-3.5" aria-hidden /> Every purchase protected by escrow
          </p>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-brand-black sm:text-5xl">
            Buy and sell second-hand, <span className="underline decoration-brand-yellow decoration-4 underline-offset-4">without the risk.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base text-neutral-600 sm:text-lg">
            Verified sellers across Kenya. Pay with M-Pesa — we hold your money until you confirm the item arrived as described.
          </p>
          <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href={sellHref} className="inline-flex h-14 w-full items-center sm:w-auto sm:flex-1 justify-center gap-2 rounded-full bg-brand-yellow px-8 text-lg font-extrabold text-brand-black shadow-md ring-2 ring-brand-black transition-colors hover:bg-brand-yellow-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue/40">
              <PlusCircle className="size-6" aria-hidden /> Sell an item
            </Link>
            {user ? (
              <Link href="/listings" className="inline-flex h-14 w-full items-center sm:w-auto sm:flex-1 justify-center gap-2 rounded-full bg-brand-black px-8 text-lg font-extrabold text-white shadow-md transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue/40">
                <Search className="size-6" aria-hidden /> Browse items
              </Link>
            ) : (
              <Link href="/login" className="inline-flex h-14 w-full items-center sm:w-auto sm:flex-1 justify-center gap-2 rounded-full bg-brand-black px-8 text-lg font-extrabold text-white shadow-md transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue/40">
                <LogIn className="size-6" aria-hidden /> Log in
              </Link>
            )}
          </div>
          <form action="/listings" role="search" className="mt-8 flex w-full max-w-2xl gap-2">
            <label htmlFor="hero-q" className="sr-only">Search listings</label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-neutral-400" aria-hidden />
              <input
                id="hero-q"
                name="q"
                placeholder="Search phones, sofas, laptops…"
                className="h-12 w-full rounded-xl border border-neutral-300 bg-white pr-3 pl-10 text-base outline-none focus-visible:border-brand-black focus-visible:ring-3 focus-visible:ring-brand-yellow/40"
              />
            </div>
            <Button type="submit" size="lg" variant="dark" className="h-12 px-6">Search</Button>
          </form>
          <ul className="mt-8 grid max-w-3xl gap-4 text-left text-sm text-neutral-700 sm:grid-cols-3">
            <li className="flex items-start gap-2"><BadgeCheck className="mt-0.5 size-5 shrink-0 text-brand-blue" aria-hidden /> Sellers verified with national ID</li>
            <li className="flex items-start gap-2"><Wallet className="mt-0.5 size-5 shrink-0 text-brand-blue" aria-hidden /> M-Pesa held safely in escrow</li>
            <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-blue" aria-hidden /> Refund if it never arrives</li>
          </ul>
        </div>
      </section>

      <section className="container-page py-10" aria-labelledby="cat-h">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="cat-h" className="text-xl font-semibold">Browse categories</h2>
          <Link href="/listings" className="text-sm font-medium text-brand-blue hover:underline">All listings</Link>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/listings?category=${c.slug}`} className="flex items-center gap-3 rounded-xl border bg-white p-4 transition hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-brand-blue">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-yellow/15 text-brand-black"><CategoryIcon name={c.icon} className="size-5" /></span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c._count.listings} listings</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {featured.length > 0 && (
        <section className="container-page pb-10" aria-labelledby="feat-h">
          <h2 id="feat-h" className="mb-4 text-xl font-semibold">Featured</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        </section>
      )}

      <section className="container-page pb-14" aria-labelledby="latest-h">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="latest-h" className="text-xl font-semibold">Latest listings</h2>
          <Link href="/listings?sort=newest" className="text-sm font-medium text-brand-blue hover:underline">See more</Link>
        </div>
        {latest.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {latest.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        ) : (
          <p className="text-muted-foreground">No listings yet.</p>
        )}
      </section>

      <section className="border-t bg-white">
        <div className="container-page flex flex-col items-start gap-4 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Have something to sell?</h2>
            <p className="text-neutral-600">Get verified once, then sell to buyers who know their money is safe.</p>
          </div>
          <Button asChild size="lg"><Link href="/sell">Start selling</Link></Button>
        </div>
      </section>
    </>
  );
}
