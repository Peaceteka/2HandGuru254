import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";

export const metadata: Metadata = { title: "Privacy policy" };

export default function Privacy() {
  return (
    <StaticPage title="Privacy policy" intro="How we handle your personal data, in line with Kenya's Data Protection Act, 2019. Review with counsel before launch.">
      <h2>What we collect</h2>
      <ul>
        <li>Account details: name, email, phone number, county.</li>
        <li>Seller verification: full name, national ID number and ID photo, business details.</li>
        <li>Transactions: orders, M-Pesa receipts and payout records, delivery details.</li>
      </ul>
      <h2>Why we use it</h2>
      <p>To run your account, verify sellers, process escrow payments and payouts, resolve disputes, prevent fraud, and send service notifications by email, SMS and in-app.</p>
      <h2>Who can see it</h2>
      <p>ID documents are visible only to you and our admin team. Delivery details are shared with the seller of an order you have paid for. Payments are processed by Safaricom M-Pesa.</p>
      <h2>Your rights</h2>
      <p>You may request access to, correction of, or deletion of your data, subject to records we must keep for financial and legal purposes. Contact us via the Contact page.</p>
    </StaticPage>
  );
}
