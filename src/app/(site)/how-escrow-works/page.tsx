import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { StaticPage } from "@/components/static-page";

export const metadata: Metadata = { title: "How escrow works" };
export const dynamic = "force-dynamic";

export default async function HowEscrowWorks() {
  const s = await getSettings();
  const steps = [
    ["Buyer pays with M-Pesa", "Tap “Buy with Escrow”, enter your M-Pesa number and approve the STK prompt on your phone. The money is held by 2ndHandGuru — the seller does not receive it yet, and the item is reserved for you."],
    ["Seller dispatches", `The seller is notified that payment is secured and must dispatch within ${s.dispatchWindowHours} hours, adding courier and tracking details. If they don't, you can cancel and get a full refund.`],
    ["Buyer checks the item", "When it arrives, inspect it. If it's as described, tap “Confirm receipt”. If something is wrong, tap “Raise a dispute” and upload photos — funds stay frozen."],
    ["Seller gets paid", `Once you confirm, we send the payment to the seller's M-Pesa minus a ${s.commissionPercent}% platform fee. If you don't confirm or dispute within ${s.autoReleaseDays} days of dispatch, payment is released automatically.`],
  ];
  return (
    <StaticPage title="How escrow works" intro="Escrow means a neutral party holds the money until both sides have done their part. On 2ndHandGuru, that neutral party is us.">
      <ol>
        {steps.map(([t, d], i) => (
          <li key={t}><strong>{i + 1}. {t}.</strong> {d}</li>
        ))}
      </ol>
      <h2>Disputes</h2>
      <p>When a dispute is raised, both the buyer and seller can add evidence. Our team reviews it and either releases the payment to the seller or refunds the buyer. Every shilling is tracked in a double-entry ledger so balances are always auditable.</p>
      <h2>Stay safe</h2>
      <ul>
        <li>Never pay a seller directly via Send Money, Till or Paybill outside 2ndHandGuru — you lose buyer protection.</li>
        <li>Only confirm receipt once you have the item in hand and it works as described.</li>
        <li>Sellers: only dispatch after the order shows “Paid — held in escrow”.</li>
      </ul>
      <p><Link href="/listings">Start browsing</Link> or <Link href="/contact">contact us</Link> with questions.</p>
    </StaticPage>
  );
}
