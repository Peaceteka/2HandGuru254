import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { StaticPage } from "@/components/static-page";

export const metadata: Metadata = { title: "Terms of service" };
export const dynamic = "force-dynamic";

export default async function Terms() {
  const s = await getSettings();
  return (
    <StaticPage title="Terms of service" intro="Plain-language summary of the rules for using 2ndHandGuru. This MVP text should be reviewed by counsel before launch.">
      <h2>1. Accounts</h2>
      <p>You must provide accurate details and keep your password private. One person may hold one account. We may suspend accounts that break these terms.</p>
      <h2>2. Selling</h2>
      <p>Sellers must be approved after ID verification. Listings must be accurate, legal to sell in Kenya, and owned by the seller. Prohibited items include weapons, drugs, stolen goods, counterfeit goods and live animals.</p>
      <h2>3. Escrow payments</h2>
      <p>All purchases must be paid through 2ndHandGuru via M-Pesa. Funds are held in escrow and released to the seller when the buyer confirms receipt, when an admin resolves a dispute, or automatically {s.autoReleaseDays} days after dispatch if the buyer takes no action. Sellers must dispatch within {s.dispatchWindowHours} hours of payment or the buyer may cancel for a full refund.</p>
      <h2>4. Fees</h2>
      <p>We deduct a platform commission (currently {s.commissionPercent}%) from the sale price before paying the seller. Buyers pay no platform fee. M-Pesa charges may apply.</p>
      <h2>5. Disputes</h2>
      <p>Buyers may raise a dispute after dispatch and before release. Both parties may submit evidence. Our decision on release or refund is final for the purposes of the escrow.</p>
      <h2>6. Liability</h2>
      <p>2ndHandGuru is a marketplace; the contract of sale is between buyer and seller. Our liability is limited to the amount held in escrow for the affected order.</p>
    </StaticPage>
  );
}
