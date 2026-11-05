import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { accountBalances, trialBalance } from "@/lib/ledger";
import { formatKES } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/dashboard-shell";

export const metadata: Metadata = { title: "Admin dashboard" };
export const dynamic = "force-dynamic";

const ACCOUNT_LABELS = {
  ESCROW_HELD: "Escrow held",
  SELLER_PAYABLE: "Seller payable (awaiting B2C)",
  REFUNDS_PAYABLE: "Refunds payable (awaiting B2C)",
  PLATFORM_FEE: "Platform fee revenue",
  MPESA_CLEARING: "M-Pesa clearing (net cash)",
} as const;

export default async function AdminDashboard() {
  await requireAdmin();
  const [users, apps, active, gmv, disputes, balances, tb, byStatus] = await Promise.all([
    db.user.count(),
    db.sellerProfile.count({ where: { status: "PENDING" } }),
    db.listing.count({ where: { status: "ACTIVE" } }),
    db.order.aggregate({ where: { status: { in: ["PAID_HELD", "DISPATCHED", "DELIVERED_CONFIRMED", "DISPUTED", "RELEASED"] } }, _sum: { amount: true } }),
    db.dispute.count({ where: { status: "OPEN" } }),
    accountBalances(),
    trialBalance(),
    db.order.groupBy({ by: ["status"], _count: true }),
  ]);
  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Users" value={users.toLocaleString()} href="/admin/users" />
        <StatCard label="Pending seller applications" value={apps} href="/admin/applications" />
        <StatCard label="Active listings" value={active.toLocaleString()} href="/admin/listings" />
        <StatCard label="GMV (paid orders)" value={formatKES(gmv._sum.amount ?? 0)} />
        <StatCard label="Funds in escrow" value={formatKES(balances.ESCROW_HELD)} href="/admin/orders" />
        <StatCard label="Open disputes" value={disputes} href="/admin/disputes" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-white p-5" aria-labelledby="ledger-h">
          <h2 id="ledger-h" className="font-semibold">Ledger balances</h2>
          <p className={`mt-1 text-xs ${tb.balanced ? "text-emerald-700" : "font-semibold text-red-700"}`}>
            Trial balance: debits {formatKES(tb.debits)} / credits {formatKES(tb.credits)} — {tb.balanced ? "balanced" : "OUT OF BALANCE"}
          </p>
          <dl className="mt-3 divide-y text-sm">
            {(Object.keys(ACCOUNT_LABELS) as (keyof typeof ACCOUNT_LABELS)[]).map((k) => (
              <div key={k} className="flex justify-between py-2"><dt>{ACCOUNT_LABELS[k]}</dt><dd className="font-medium tabular-nums">{formatKES(balances[k])}</dd></div>
            ))}
          </dl>
        </section>
        <section className="rounded-xl border bg-white p-5" aria-labelledby="status-h">
          <h2 id="status-h" className="font-semibold">Orders by state</h2>
          <dl className="mt-3 divide-y text-sm">
            {byStatus.map((s) => (
              <div key={s.status} className="flex justify-between py-2"><dt>{s.status.replaceAll("_", " ").toLowerCase()}</dt><dd className="font-medium">{s._count}</dd></div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}
