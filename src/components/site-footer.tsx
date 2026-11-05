import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-brand-black text-neutral-300">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo inverted />
          <p className="mt-3 max-w-xs text-sm text-neutral-400">
            Kenya&apos;s second-hand marketplace with verified sellers and M-Pesa escrow buyer protection.
          </p>
          <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-white">
            <ShieldCheck className="size-4 text-brand-yellow" aria-hidden /> Pay safely. Get what you paid for.
          </p>
        </div>
        <FooterCol title="Marketplace" links={[["/listings", "Browse listings"], ["/register?type=seller", "Become a seller"], ["/how-escrow-works", "How escrow works"]]} />
        <FooterCol title="Company" links={[["/about", "About us"], ["/contact", "Contact"]]} />
        <FooterCol title="Legal" links={[["/terms", "Terms of service"], ["/privacy", "Privacy policy"]]} />
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} 2ndHandGuru. Payments powered by M-Pesa.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="hover:text-brand-yellow">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
