import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatDate, formatKES } from "@/lib/format";
import { DISPUTE_REASON_LABELS } from "@/lib/constants";
import { PageHeader, EmptyState } from "@/components/dashboard-shell";

export const metadata: Metadata = { title: "Disputes" };

export default async function Disputes({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await requireAdmin();
  const { all } = await searchParams;
  const disputes = await db.dispute.findMany({
    where: all ? {} : { status: "OPEN" },
    orderBy: { createdAt: all ? "desc" : "asc" },
    include: { order: { select: { code: true, amount: true, listing: { select: { title: true } } } }, openedBy: { select: { name: true } } },
  });
  return (
    <>
      <PageHeader title="Disputes" action={<Link href={all ? "/admin/disputes" : "/admin/disputes?all=1"} className="text-sm text-brand-blue hover:underline">{all ? "Show open only" : "Show all"}</Link>} />
      {disputes.length ? (
        <ul className="divide-y rounded-xl border bg-white">
          {disputes.map((d) => (
            <li key={d.id}>
              <Link href={`/admin/disputes/${d.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-neutral-50">
                <span><span className="font-medium">{d.order.listing.title}</span><span className="block text-xs text-muted-foreground">{d.order.code} · {DISPUTE_REASON_LABELS[d.reason]} · by {d.openedBy.name} · {formatDate(d.createdAt)}</span></span>
                <span className="text-right text-sm"><span className="font-semibold">{formatKES(d.order.amount)}</span><span className="block text-xs">{d.status.replaceAll("_", " ").toLowerCase()}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="No open disputes" />}
    </>
  );
}
