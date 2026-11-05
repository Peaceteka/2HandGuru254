import "server-only";
import type { LedgerAccount, LedgerTxnType, Prisma } from "@prisma/client";
import { db } from "./db";

/**
 * Double-entry ledger. Account normal balances:
 *  MPESA_CLEARING  – asset (debit-normal): money sitting in the platform's M-Pesa shortcode
 *  ESCROW_HELD     – liability (credit-normal): buyer funds held pending delivery
 *  SELLER_PAYABLE  – liability (credit-normal): released funds owed to sellers until B2C succeeds
 *  REFUNDS_PAYABLE – liability (credit-normal): funds owed back to buyers until B2C succeeds
 *  PLATFORM_FEE    – revenue (credit-normal): commission earned
 */
export type LedgerLine = { account: LedgerAccount; debit?: number; credit?: number; userId?: string | null };

export async function postLedger(
  tx: Prisma.TransactionClient,
  orderId: string,
  type: LedgerTxnType,
  idempotencyKey: string,
  description: string,
  lines: LedgerLine[],
) {
  const debits = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const credits = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  if (debits !== credits || debits <= 0) throw new Error(`Unbalanced ledger transaction ${type}: ${debits} != ${credits}`);

  const key = `${type}:${idempotencyKey}`;
  const existing = await tx.ledgerTransaction.findUnique({ where: { idempotencyKey: key } });
  if (existing) return existing; // idempotent

  return tx.ledgerTransaction.create({
    data: {
      orderId,
      type,
      idempotencyKey: key,
      description,
      entries: {
        create: lines
          .filter((l) => (l.debit ?? 0) > 0 || (l.credit ?? 0) > 0)
          .map((l) => ({
            account: l.account,
            direction: (l.debit ?? 0) > 0 ? ("DEBIT" as const) : ("CREDIT" as const),
            amount: (l.debit ?? 0) > 0 ? l.debit! : l.credit!,
            userId: l.userId ?? null,
          })),
      },
    },
  });
}

const CREDIT_NORMAL: LedgerAccount[] = ["ESCROW_HELD", "SELLER_PAYABLE", "REFUNDS_PAYABLE", "PLATFORM_FEE"];

export async function accountBalances(where: Prisma.LedgerEntryWhereInput = {}) {
  const rows = await db.ledgerEntry.groupBy({ by: ["account", "direction"], where, _sum: { amount: true } });
  const result: Record<LedgerAccount, number> = {
    MPESA_CLEARING: 0,
    ESCROW_HELD: 0,
    SELLER_PAYABLE: 0,
    REFUNDS_PAYABLE: 0,
    PLATFORM_FEE: 0,
  };
  for (const r of rows) {
    const amt = r._sum.amount ?? 0;
    const sign = CREDIT_NORMAL.includes(r.account) ? (r.direction === "CREDIT" ? 1 : -1) : r.direction === "DEBIT" ? 1 : -1;
    result[r.account] += sign * amt;
  }
  return result;
}

/** Sum of all debits minus credits across the whole ledger — must always be 0. */
export async function trialBalance() {
  const rows = await db.ledgerEntry.groupBy({ by: ["direction"], _sum: { amount: true } });
  const d = rows.find((r) => r.direction === "DEBIT")?._sum.amount ?? 0;
  const c = rows.find((r) => r.direction === "CREDIT")?._sum.amount ?? 0;
  return { debits: d, credits: c, balanced: d === c };
}
