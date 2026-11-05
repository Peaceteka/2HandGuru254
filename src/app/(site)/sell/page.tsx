import { redirect } from "next/navigation";
import { getCurrentUser, isApprovedSeller } from "@/lib/session";

export default async function SellEntry() {
  const user = await getCurrentUser();
  if (!user) redirect("/register?type=seller");
  if (user.role === "ADMIN") redirect("/admin/listings/new");
  if (isApprovedSeller(user)) redirect("/seller/listings/new");
  if (user.sellerProfile?.status === "PENDING" || user.sellerProfile?.status === "REJECTED") redirect("/sell/pending");
  redirect("/sell/apply");
}
