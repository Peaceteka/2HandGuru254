import type { Metadata } from "next";
import Link from "next/link";
import type { OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatDate, formatKES } from "@/lib/format";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/dashboard-shell";
import { OrderStatusBadge } from "@/components/badges";
import { Pagination } from "@/components/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Orders & escrow" };
const PER = 30;

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = sp.status && sp.status in ORDER_STATUS_LABELS ? (sp.status as OrderStatus) : undefined;
  const where: Prisma.OrderWhereInput = { ...(status ? { status } : {}), ...(sp.q ? { code: { contains: sp.q.toUpperCase() } } : {}) };
  const [total, orders] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER, include: { buyer: { select: { name: true } }, seller: { select: { name: true } }, listing: { select: { title: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Orders & escrow" description={`${total} orders`} />
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={sp.q} placeholder="Order code" className="max-w-xs" aria-label="Order code" />
        <select name="status" defaultValue={sp.status ?? ""} className="h-10 rounded-lg border px-3 text-sm" aria-label="Status">
          <option value="">All states</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Item</TableHead><TableHead>Buyer → Seller</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>State</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell><Link href={`/admin/orders/${o.id}`} className="font-mono text-xs text-brand-blue hover:underline">{o.code}</Link></TableCell>
                <TableCell className="max-w-48 truncate">{o.listing.title}</TableCell>
                <TableCell className="text-xs">{o.buyer.name} → {o.seller.name}</TableCell>
                <TableCell className="text-right">{formatKES(o.amount)}</TableCell>
                <TableCell><OrderStatusBadge status={o.status} /></TableCell>
                <TableCell className="text-xs whitespace-nowrap">{formatDate(o.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-4"><Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PER))} makeHref={(p) => `/admin/orders?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(p) })}`} /></div>
    </>
  );
}
