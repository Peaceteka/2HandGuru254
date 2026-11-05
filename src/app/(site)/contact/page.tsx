import type { Metadata } from "next";
import { StaticPage } from "@/components/static-page";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = { title: "Contact" };

export default function Contact() {
  return (
    <StaticPage title="Contact us" intro="We usually reply within one business day.">
      <p>For order issues, please open a dispute from the order page so funds stay protected while we look into it. For anything else, send us a message.</p>
      <div className="not-prose mt-6"><ContactForm /></div>
    </StaticPage>
  );
}
