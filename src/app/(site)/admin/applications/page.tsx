import type { Metadata } from "next";
import Link from "next/link";
import type { SellerApplicationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatDate } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/dashboard-shell";

export const metadata: Metadata = { title: "Seller applications" };

export default async function Applications({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = (["PENDING", "APPROVED", "REJECTED"].includes(sp.status ?? "") ? sp.status : "PENDING") as SellerApplicationStatus;
  const apps = await db.sellerProfile.findMany({ where: { status, isPlatform: false }, orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" }, include: { user: { select: { email: true } } } });
  return (
    <>
      <PageHeader title="Seller applications" />
      <nav className="mb-4 flex gap-1" aria-label="Filter">
        {["PENDING", "APPROVED", "REJECTED"].map((s) => (
          <Link key={s} href={`/admin/applications?status=${s}`} aria-current={s === status ? "page" : undefined} className="rounded-full border px-3 py-1 text-sm aria-[current=page]:bg-brand-black aria-[current=page]:text-white">{s.toLowerCase()}</Link>
        ))}
      </nav>
      {apps.length ? (
        <ul className="divide-y rounded-xl border bg-white">
          {apps.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/applications/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-neutral-50">
                <span><span className="font-medium">{a.fullName}</span>{a.businessName && <span className="text-neutral-600"> · {a.businessName}</span>}<span className="block text-xs text-muted-foreground">{a.user.email} · {a.county}</span></span>
                <span className="text-xs text-muted-foreground">Applied {formatDate(a.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <EmptyState title={`No ${status.toLowerCase()} applications`} />}
    </>
  );
}
