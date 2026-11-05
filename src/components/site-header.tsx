import Link from "next/link";
import { Bell, LogIn, PlusCircle, Search } from "lucide-react";
import { getCurrentUser, isApprovedSeller, sellHrefFor } from "@/lib/session";
import { db } from "@/lib/db";
import { Logo } from "./logo";
import { UserMenu, MobileMenu } from "./user-menu";

const CTA = "inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-bold sm:h-11 sm:px-6 sm:text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue/40 sm:px-6";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const unread = user ? await db.notification.count({ where: { userId: user.id, readAt: null } }) : 0;
  const sellHref = sellHrefFor(user);
  const menuUser = user
    ? { name: user.name, email: user.email, role: user.role, isSeller: isApprovedSeller(user), hasApplication: !!user.sellerProfile }
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:h-20 sm:gap-3 sm:px-4">
        <MobileMenu user={menuUser} sellHref={sellHref} />
        <Logo />
        <form action="/listings" className="relative ml-4 hidden max-w-xl flex-1 md:block" role="search">
          <label htmlFor="header-q" className="sr-only">Search listings</label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id="header-q"
            name="q"
            placeholder="Search phones, sofas, laptops…"
            className="h-10 w-full rounded-full border border-input bg-muted/60 pr-4 pl-9 text-sm outline-none focus:border-brand-blue focus:bg-white focus:ring-3 focus:ring-brand-blue/20"
          />
        </form>
        <nav className="ml-auto flex items-center gap-1 sm:gap-2" aria-label="Main">
          <Link href="/how-escrow-works" className="hidden px-2 text-sm text-neutral-700 hover:text-brand-black lg:block">
            How escrow works
          </Link>
          {user && (
            <Link href="/account/notifications" className="relative rounded-full p-2 hover:bg-muted" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
              <Bell className="size-5" aria-hidden />
              {unread > 0 && (
                <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-brand-yellow px-1 text-[10px] font-bold text-brand-black">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          )}
          <Link href={sellHref} className={`${CTA} bg-brand-yellow text-brand-black ring-2 ring-brand-black hover:bg-brand-yellow-dark`}>
            <PlusCircle className="size-4 sm:size-5" aria-hidden /> Sell
          </Link>
          {menuUser ? (
            <UserMenu user={menuUser} />
          ) : (
            <Link href="/login" className={`${CTA} bg-brand-black text-white hover:bg-neutral-800`}>
              <LogIn className="size-4 sm:size-5" aria-hidden /> Log in
            </Link>
          )}
        </nav>
      </div>
      <form action="/listings" className="px-4 pb-3 md:hidden" role="search">
        <label htmlFor="header-q-m" className="sr-only">Search listings</label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id="header-q-m"
            name="q"
            placeholder="What are you looking for?"
            className="h-10 w-full rounded-full border border-input bg-muted/60 pr-4 pl-9 text-sm outline-none focus:border-brand-blue focus:bg-white focus:ring-3 focus:ring-brand-blue/20"
          />
        </div>
      </form>
    </header>
  );
}
