import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireApprovedSeller } from "@/lib/session";
import { formatDate, formatKES } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { PageHeader, EmptyState, StatCard } from "@/components/dashboard-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Payouts" };

const LABEL = { PENDING: "Processing", SUCCESS: "Sent", FAILED: "Failed — retrying", INTERNAL: "Internal" } as const;

export default async function Payouts() {
  const user = await requireApprovedSeller();
  const payouts = await db.payout.findMany({ where: { userId: user.id, type: "SELLER_PAYOUT" }, orderBy: { createdAt: "desc" }, include: { order: { select: { id: true, code: true, amount: true, platformFee: true } } } });
  const sent = payouts.filter((p) => p.status === "SUCCESS").reduce((s, p) => s + p.amount, 0);
  return (
    <>
      <PageHeader title="Payouts" description={`Released escrow payments are sent to your M-Pesa number ${user.mpesaPayoutPhone ? displayPhone(user.mpesaPayoutPhone) : "(not set)"}.`} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md"><StatCard label="Total paid out" value={formatKES(sent)} /><StatCard label="Payouts" value={payouts.length} /></div>
      {payouts.length ? (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Order</TableHead><TableHead className="text-right">Sale</TableHead><TableHead className="text-right">Fee</TableHead><TableHead className="text-right">Paid</TableHead><TableHead>Status</TableHead><TableHead>M-Pesa ref</TableHead></TableRow></TableHeader>
            <TableBody>
              {payouts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(p.createdAt)}</TableCell>
                  <TableCell><Link href={`/seller/orders/${p.order.id}`} className="text-brand-blue hover:underline">{p.order.code}</Link></TableCell>
                  <TableCell className="text-right">{formatKES(p.order.amount)}</TableCell>
                  <TableCell className="text-right">−{formatKES(p.order.platformFee)}</TableCell>
                  <TableCell className="text-right font-medium">{formatKES(p.amount)}</TableCell>
                  <TableCell>{LABEL[p.status]}</TableCell>
                  <TableCell className="font-mono text-xs">{p.transactionId ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState title="No payouts yet" description="When a buyer confirms receipt, your payment is released here." />
      )}
    </>
  );
}
