import "server-only";
import { cache } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { db } from "./db";

/** Loads the signed-in user fresh from the DB (role/status changes apply immediately). */
export const getCurrentUser = cache(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({ where: { id: session.user.id }, include: { sellerProfile: true } });
  if (!user || user.status !== "ACTIVE") return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(callbackUrl = "/") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return user;
}

export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

export function isApprovedSeller(user: CurrentUser) {
  return user.role === "SELLER" && user.sellerProfile?.status === "APPROVED";
}

export async function requireApprovedSeller() {
  const user = await requireUser("/seller");
  if (user.role === "ADMIN") redirect("/admin");
  if (!isApprovedSeller(user)) redirect(user.sellerProfile ? "/sell/pending" : "/sell/apply");
  return user;
}

/** Where the "Sell" call-to-action should take the current visitor. */
export function sellHrefFor(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return "/register?type=seller";
  if (user.role === "ADMIN") return "/admin/listings/new";
  if (isApprovedSeller(user)) return "/seller/listings/new";
  return user.sellerProfile ? "/sell/pending" : "/sell/apply";
}
