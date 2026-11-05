"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { adminRefund, adminRelease, resolveDispute, retryPayout } from "@/lib/escrow";
import { saveSettings } from "@/lib/settings";
import { type ActionResult, categorySchema, fail, formObject, reasonSchema, settingsSchema } from "@/lib/validators";
import { safeAction } from "./utils";

function reasonFrom(fd: FormData) {
  return reasonSchema.safeParse({ reason: fd.get("reason") ?? "" });
}

export async function approveApplicationAction(profileId: string): Promise<ActionResult> {
  return safeAction(async () => {
    const admin = await requireAdmin();
    const profile = await db.sellerProfile.findUnique({ where: { id: profileId } });
    if (!profile || profile.status !== "PENDING") return { error: "Application not found or already reviewed." };
    await db.$transaction(async (tx) => {
      await tx.sellerProfile.update({ where: { id: profileId }, data: { status: "APPROVED", reviewedById: admin.id, reviewedAt: new Date(), rejectionReason: null } });
      await tx.user.update({ where: { id: profile.userId }, data: { role: "SELLER", mpesaPayoutPhone: profile.phone } });
      await audit(admin.id, "seller.approve", "SellerProfile", profileId, { userId: profile.userId }, tx);
    });
    await notify(profile.userId, {
      type: "APPLICATION_APPROVED",
      title: "You're approved to sell on 2ndHandGuru",
      body: "Your seller account is verified. You can now post listings and receive escrow-protected payments.",
      link: "/seller",
    }, { email: true, sms: true });
    revalidatePath("/admin/applications");
    return { ok: true, message: "Seller approved and notified." };
  });
}

export async function rejectApplicationAction(profileId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const admin = await requireAdmin();
    const parsed = reasonFrom(fd);
    if (!parsed.success) return fail(parsed.error);
    const profile = await db.sellerProfile.findUnique({ where: { id: profileId } });
    if (!profile || profile.status !== "PENDING") return { error: "Application not found or already reviewed." };
    await db.$transaction(async (tx) => {
      await tx.sellerProfile.update({ where: { id: profileId }, data: { status: "REJECTED", rejectionReason: parsed.data.reason, reviewedById: admin.id, reviewedAt: new Date() } });
      await audit(admin.id, "seller.reject", "SellerProfile", profileId, { reason: parsed.data.reason }, tx);
    });
    await notify(profile.userId, {
      type: "APPLICATION_REJECTED",
      title: "Your seller application was not approved",
      body: `Reason: ${parsed.data.reason}. You can update your details and apply again.`,
      link: "/sell/pending",
    }, { email: true, sms: true });
    revalidatePath("/admin/applications");
    redirect("/admin/applications");
  });
}

export async function setUserStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED", _: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const admin = await requireAdmin();
    if (userId === admin.id) return { error: "You can't change your own status." };
    const reason = status === "SUSPENDED" ? reasonFrom(fd) : null;
    if (reason && !reason.success) return fail(reason.error);
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { status, suspendedReason: reason?.data?.reason ?? null } });
      if (status === "SUSPENDED") await tx.listing.updateMany({ where: { sellerId: userId, status: "ACTIVE" }, data: { status: "HIDDEN", moderationNote: "Seller suspended" } });
      await audit(admin.id, status === "SUSPENDED" ? "user.suspend" : "user.reactivate", "User", userId, { reason: reason?.data?.reason }, tx);
    });
    if (status === "SUSPENDED") {
      await notify(userId, { type: "ACCOUNT_SUSPENDED", title: "Your account has been suspended", body: `Reason: ${reason?.data?.reason}. Contact support if you believe this is a mistake.` }, { email: true, inApp: false });
    }
    revalidatePath("/admin/users");
    return { ok: true, message: status === "SUSPENDED" ? "User suspended." : "User reactivated." };
  });
}

export async function moderateListingAction(listingId: string, status: "HIDDEN" | "REMOVED" | "ACTIVE", _: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const admin = await requireAdmin();
    const listing = await db.listing.findUnique({ where: { id: listingId } });
    if (!listing) return { error: "Listing not found." };
    if (listing.status === "RESERVED" || listing.status === "SOLD") return { error: "Listings with paid orders can't be moderated." };
    const note = String(fd.get("reason") ?? "").trim() || null;
    await db.$transaction(async (tx) => {
      await tx.listing.update({ where: { id: listingId }, data: { status, moderationNote: status === "ACTIVE" ? null : note } });
      await audit(admin.id, `listing.${status.toLowerCase()}`, "Listing", listingId, { title: listing.title, reason: note }, tx);
    });
    revalidatePath("/admin/listings");
    revalidatePath(`/listings/${listingId}`);
    return { ok: true, message: `Listing ${status === "ACTIVE" ? "restored" : status.toLowerCase()}.` };
  });
}

export async function toggleFeaturedAction(listingId: string): Promise<ActionResult> {
  return safeAction(async () => {
    const admin = await requireAdmin();
    const l = await db.listing.findUniqueOrThrow({ where: { id: listingId } });
    await db.listing.update({ where: { id: listingId }, data: { featured: !l.featured } });
    await audit(admin.id, l.featured ? "listing.unfeature" : "listing.feature", "Listing", listingId);
    revalidatePath("/admin/listings");
    revalidatePath("/");
    return { ok: true, message: l.featured ? "Removed from featured." : "Featured on the home page." };
  });
}

export async function saveCategoryAction(categoryId: string | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const admin = await requireAdmin();
    const parsed = categorySchema.safeParse(formObject(fd));
    if (!parsed.success) return fail(parsed.error);
    const clash = await db.category.findFirst({ where: { OR: [{ name: parsed.data.name }, { slug: parsed.data.slug }], NOT: categoryId ? { id: categoryId } : undefined } });
    if (clash) return { error: "A category with that name or slug already exists." };
    const cat = categoryId
      ? await db.category.update({ where: { id: categoryId }, data: parsed.data })
      : await db.category.create({ data: parsed.data });
    await audit(admin.id, categoryId ? "category.update" : "category.create", "Category", cat.id, parsed.data);
    revalidatePath("/admin/categories");
    revalidatePath("/");
    return { ok: true, message: "Category saved." };
  });
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionResult> {
  return safeAction(async () => {
    const admin = await requireAdmin();
    const count = await db.listing.count({ where: { categoryId } });
    if (count > 0) return { error: `Move or remove the ${count} listing(s) in this category first.` };
    const cat = await db.category.delete({ where: { id: categoryId } });
    await audit(admin.id, "category.delete", "Category", categoryId, { name: cat.name });
    revalidatePath("/admin/categories");
    return { ok: true, message: "Category deleted." };
  });
}

export async function adminReleaseAction(orderId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const admin = await requireAdmin();
    const parsed = reasonFrom(fd);
    if (!parsed.success) return fail(parsed.error);
    await adminRelease(orderId, admin.id, parsed.data.reason);
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Funds released to seller." };
  });
}

export async function adminRefundAction(orderId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const admin = await requireAdmin();
    const parsed = reasonFrom(fd);
    if (!parsed.success) return fail(parsed.error);
    await adminRefund(orderId, admin.id, parsed.data.reason);
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Buyer refunded." };
  });
}

export async function retryPayoutAction(payoutId: string, orderId: string): Promise<ActionResult> {
  return safeAction(async () => {
    const admin = await requireAdmin();
    await retryPayout(payoutId, admin.id);
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Payout re-sent to M-Pesa." };
  });
}

export async function resolveDisputeAction(disputeId: string, outcome: "RELEASE" | "REFUND", _: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const admin = await requireAdmin();
    const parsed = reasonFrom(fd);
    if (!parsed.success) return fail(parsed.error);
    await resolveDispute(disputeId, admin.id, outcome, parsed.data.reason);
    revalidatePath(`/admin/disputes/${disputeId}`);
    return { ok: true, message: outcome === "RELEASE" ? "Released to seller." : "Refunded to buyer." };
  });
}

export async function saveSettingsAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const admin = await requireAdmin();
    const parsed = settingsSchema.safeParse(formObject(fd));
    if (!parsed.success) return fail(parsed.error);
    await saveSettings(parsed.data);
    await audit(admin.id, "settings.update", "Setting", "platform", parsed.data);
    revalidatePath("/admin/settings");
    return { ok: true, message: "Settings saved. New orders will use these values." };
  });
}
