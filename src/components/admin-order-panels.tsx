import { formatDate, formatKES } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import type { OrderDetail } from "@/lib/order-queries";
import { RetryPayoutButton } from "@/components/admin-ui";

export function PaymentsAndLedger({ order }: { order: OrderDetail }) {
  return (
    <>
      <section className="rounded-xl border bg-white p-5">
        <h2 className="mb-3 font-semibold">M-Pesa payments (STK)</h2>
        {order.payments.length ? (
          <ul className="space-y-1 text-sm">
            {order.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2">
                <span>{formatDate(p.createdAt, true)} · {displayPhone(p.phone)} · {formatKES(p.amount)}</span>
                <span className="font-mono text-xs">{p.status}{p.mpesaReceipt ? ` · ${p.mpesaReceipt}` : ""}{p.resultDesc ? ` · ${p.resultDesc}` : ""}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">No payment attempts.</p>}
        <h2 className="mt-5 mb-3 font-semibold">Payouts & refunds (B2C)</h2>
        {order.payouts.length ? (
          <ul className="space-y-2 text-sm">
            {order.payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{p.type === "SELLER_PAYOUT" ? "Seller payout" : "Buyer refund"} · {formatKES(p.amount)} → {displayPhone(p.phone)}</span>
                <span className="flex items-center gap-2 font-mono text-xs">{p.status}{p.transactionId ? ` · ${p.transactionId}` : ""}{p.resultDesc ? ` · ${p.resultDesc}` : ""}
                  {(p.status === "FAILED" || p.status === "PENDING") && <RetryPayoutButton payoutId={p.id} orderId={order.id} />}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">None.</p>}
      </section>
      <section className="rounded-xl border bg-white p-5">
        <h2 className="mb-3 font-semibold">Ledger entries</h2>
        {order.ledgerTxns.length ? (
          <div className="space-y-3 text-sm">
            {order.ledgerTxns.map((t) => (
              <div key={t.id}>
                <p className="text-xs text-muted-foreground">{formatDate(t.createdAt, true)} · {t.type} · {t.description}</p>
                <table className="mt-1 w-full text-xs">
                  <tbody>
                    {t.entries.map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className="py-1 font-mono">{e.account}</td>
                        <td className="py-1 text-right tabular-nums">{e.direction === "DEBIT" ? formatKES(e.amount) : ""}</td>
                        <td className="py-1 text-right tabular-nums">{e.direction === "CREDIT" ? formatKES(e.amount) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">No ledger postings yet.</p>}
      </section>
    </>
  );
}
