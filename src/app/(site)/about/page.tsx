import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";

export const metadata: Metadata = { title: "About" };

export default function About() {
  return (
    <StaticPage title="About 2ndHandGuru" intro="A safer way for Kenyans to buy and sell pre-owned goods.">
      <p>Second-hand marketplaces are great value — until a buyer pays for a phone that never arrives, or a seller ships an item and never gets paid. 2ndHandGuru fixes that with two simple ideas:</p>
      <ul>
        <li><strong>Verified sellers.</strong> Every seller is reviewed by our team with their national ID before they can list.</li>
        <li><strong>Escrow payments.</strong> Buyers pay through M-Pesa into escrow. Sellers are paid only once the buyer confirms the item arrived as described.</li>
      </ul>
      <p>We&apos;re building for phones first, for every county in Kenya, and for people who want to trade without second-guessing.</p>
    </StaticPage>
  );
}
