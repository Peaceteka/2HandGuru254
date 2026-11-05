"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, isApprovedSeller, requireUser } from "@/lib/session";
import { realFiles, saveImageUpload, storage } from "@/lib/storage";
import { MAX_LISTING_IMAGES } from "@/lib/constants";
import { audit } from "@/lib/audit";
import { type ActionResult, fail, formObject, listingSchema } from "@/lib/validators";
import { safeAction } from "./utils";

async function platformSellerId() {
  const p = await db.sellerProfile.findFirst({ where: { isPlatform: true }, select: { userId: true } });
  if (!p) throw new Error("Platform seller account is missing — run the seed script.");
  return p.userId;
}

export async function saveListingAction(listingId: string | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser("/seller/listings");
    const isAdmin = user.role === "ADMIN";
    if (!isAdmin && !isApprovedSeller(user)) return { error: "Only approved sellers can post listings." };

    const parsed = listingSchema.safeParse(formObject(fd));
    if (!parsed.success) return fail(parsed.error);
    const category = await db.category.findUnique({ where: { id: parsed.data.categoryId } });
    if (!category) return { error: "Please fix the highlighted fields.", fieldErrors: { categoryId: ["Choose a category"] } };

    const existing = listingId ? await db.listing.findUnique({ where: { id: listingId }, include: { images: true } }) : null;
    if (listingId && (!existing || (!isAdmin && existing.sellerId !== user.id))) return { error: "Listing not found." };
    if (existing && ["RESERVED", "REMOVED"].includes(existing.status) && !isAdmin) {
      return { error: existing.status === "RESERVED" ? "This item has a paid order in escrow and can't be edited." : "This listing was removed by moderators." };
    }

    const removeIds = fd.getAll("removeImage").map(String);
    const keep = (existing?.images ?? []).filter((i) => !removeIds.includes(i.id));
    const files = realFiles(fd.getAll("images"));
    if (keep.length + files.length > MAX_LISTING_IMAGES) return { error: `You can attach up to ${MAX_LISTING_IMAGES} photos.` };
    if (parsed.data.status === "ACTIVE" && keep.length + files.length === 0) {
      return { error: "Please fix the highlighted fields.", fieldErrors: { images: ["Add at least one photo before publishing"] } };
    }

    const sellerId = existing?.sellerId ?? (isAdmin ? await platformSellerId() : user.id);
    const newKeys: string[] = [];
    for (const f of files) newKeys.push(await saveImageUpload(f, `listings/${sellerId}`));

    const data = {
      title: parsed.data.title,
      description: parsed.data.description,
      categoryId: parsed.data.categoryId,
      condition: parsed.data.condition,
      price: parsed.data.price,
      county: parsed.data.county,
      town: parsed.data.town ?? null,
      status: existing?.status === "RESERVED" ? "RESERVED" as const : parsed.data.status,
      ...(isAdmin ? { featured: parsed.data.featured === "on" } : {}),
    };

    const listing = await db.$transaction(async (tx) => {
      const l = existing
        ? await tx.listing.update({ where: { id: existing.id }, data })
        : await tx.listing.create({ data: { ...data, sellerId } });
      if (removeIds.length) await tx.listingImage.deleteMany({ where: { listingId: l.id, id: { in: removeIds } } });
      if (newKeys.length) {
        await tx.listingImage.createMany({ data: newKeys.map((key, i) => ({ listingId: l.id, key, position: keep.length + i })) });
      }
      if (isAdmin) await audit(user.id, existing ? "listing.update" : "listing.create", "Listing", l.id, { title: l.title, status: l.status }, tx);
      return l;
    });
    for (const img of existing?.images.filter((i) => removeIds.includes(i.id)) ?? []) await storage().delete(img.key).catch(() => {});

    revalidatePath("/");
    revalidatePath(`/listings/${listing.id}`);
    redirect(isAdmin ? "/admin/listings" : "/seller/listings?saved=1");
  });
}

export async function deleteListingAction(listingId: string): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser("/seller/listings");
    const listing = await db.listing.findUnique({ where: { id: listingId }, include: { images: true, _count: { select: { orders: true } } } });
    if (!listing || listing.sellerId !== user.id) return { error: "Listing not found." };
    if (listing._count.orders > 0) {
      // Keep history for orders/ledger: hide instead of deleting.
      if (listing.status === "RESERVED") return { error: "This item has an order in escrow and can't be removed." };
      await db.listing.update({ where: { id: listingId }, data: { status: "HIDDEN" } });
    } else {
      await db.listing.delete({ where: { id: listingId } });
      for (const img of listing.images) await storage().delete(img.key).catch(() => {});
    }
    revalidatePath("/seller/listings");
    return { ok: true, message: listing._count.orders > 0 ? "Listing hidden (it has order history)." : "Listing deleted." };
  });
}

export async function toggleSavedAction(listingId: string): Promise<{ saved: boolean } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "login" };
  const existing = await db.savedItem.findUnique({ where: { userId_listingId: { userId: user.id, listingId } } });
  if (existing) await db.savedItem.delete({ where: { id: existing.id } });
  else await db.savedItem.create({ data: { userId: user.id, listingId } });
  revalidatePath("/account/saved");
  return { saved: !existing };
}
