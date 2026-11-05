"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Menu, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type MenuUser = { name: string; email: string; role: string; isSeller: boolean; hasApplication: boolean } | null;

function links(user: MenuUser) {
  if (!user) return [];
  const items: { href: string; label: string }[] = [];
  if (user.role === "ADMIN") items.push({ href: "/admin", label: "Admin panel" });
  if (user.isSeller) items.push({ href: "/seller", label: "Seller dashboard" });
  else if (user.hasApplication && user.role !== "ADMIN") items.push({ href: "/sell/pending", label: "Seller application" });
  items.push(
    { href: "/account/orders", label: "My orders" },
    { href: "/account/saved", label: "Saved items" },
    { href: "/account/notifications", label: "Notifications" },
    { href: "/account/settings", label: "Account settings" },
  );
  return items;
}

export function UserMenu({ user }: { user: NonNullable<MenuUser> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu" className="rounded-full">
          <UserRound className="size-5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="truncate font-medium text-foreground">{user.name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {links(user).map((l) => (
          <DropdownMenuItem key={l.href} asChild>
            <Link href={l.href}>{l.label}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/" })}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MobileMenu({ user, sellHref }: { user: MenuUser; sellHref: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="-ml-2 md:hidden" aria-label="Open menu">
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle className="text-left">
            <span className="text-brand-yellow">2nd</span>HandGuru
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4" aria-label="Mobile">
          <Link className="rounded-lg px-3 py-2.5 hover:bg-muted" href="/listings">Browse all</Link>
          <Link className="rounded-lg px-3 py-2.5 font-semibold hover:bg-muted" href={sellHref}>Sell an item</Link>
          <Link className="rounded-lg px-3 py-2.5 hover:bg-muted" href="/how-escrow-works">How escrow works</Link>
          <hr className="my-2 border-border" />
          {user ? (
            <>
              {links(user).map((l) => (
                <Link key={l.href} className="rounded-lg px-3 py-2.5 hover:bg-muted" href={l.href}>
                  {l.label}
                </Link>
              ))}
              <button className="rounded-lg px-3 py-2.5 text-left hover:bg-muted" onClick={() => signOut({ callbackUrl: "/" })}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link className="rounded-lg px-3 py-2.5 hover:bg-muted" href="/login">Log in</Link>
              <Link className="rounded-lg px-3 py-2.5 hover:bg-muted" href="/register">Create account</Link>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
