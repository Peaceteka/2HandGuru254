"use server";

import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import { adminIds, notify, sendEmail, smsProvider } from "@/lib/notifications";
import { normalizeKenyanPhone } from "@/lib/phone";
import { saveImageUpload, UploadError } from "@/lib/storage";
import {
  type ActionResult,
  changePasswordSchema,
  fail,
  forgotPasswordSchema,
  formObject,
  profileSchema,
  registerSchema,
  resetPasswordSchema,
  sellerApplicationSchema,
  contactSchema,
} from "@/lib/validators";
import { safeAction } from "./utils";

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function registerAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await rateLimit(`register:${await clientIp()}`, 10, 60 * 60);
    const parsed = registerSchema.safeParse(formObject(fd));
    if (!parsed.success) return fail(parsed.error);
    const { name, email, phone, password, accountType } = parsed.data;

    const clash = await db.user.findFirst({ where: { OR: [{ email }, { phone }] }, select: { email: true } });
    if (clash) {
      return { error: "An account with these details already exists.", fieldErrors: clash.email === email ? { email: ["Email already registered"] } : { phone: ["Phone already registered"] } };
    }
    await db.user.create({ data: { name, email, phone, passwordHash: await bcrypt.hash(password, 12), role: "BUYER" } });
    return { ok: true, message: accountType === "SELLER" ? "/sell/apply" : "/" };
  });
}

export async function applySellerAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser("/sell/apply");
    await rateLimit(`apply:${user.id}`, 5, 60 * 60);
    if (user.role !== "BUYER") return { error: "Your account cannot apply to sell." };
    if (user.sellerProfile?.status === "PENDING" || user.sellerProfile?.status === "APPROVED") redirect("/sell/pending");

    const parsed = sellerApplicationSchema.safeParse(formObject(fd));
    if (!parsed.success) return fail(parsed.error);
    const idPhoto = fd.get("idPhoto");
    if (!(idPhoto instanceof File) || idPhoto.size === 0) return { error: "Please fix the highlighted fields.", fieldErrors: { idPhoto: ["Upload a clear photo of your ID"] } };
    let idPhotoKey: string;
    try {
      idPhotoKey = await saveImageUpload(idPhoto, `private/ids/${user.id}`);
    } catch (e) {
      if (e instanceof UploadError) return { error: e.message, fieldErrors: { idPhoto: [e.message] } };
      throw e;
    }
    const data = { ...parsed.data, idPhotoKey, status: "PENDING" as const, rejectionReason: null, reviewedAt: null, reviewedById: null };
    await db.sellerProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
    await notify(user.id, {
      type: "APPLICATION_SUBMITTED",
      title: "Seller application received",
      body: "Thanks! Our team will review your details, usually within 1 business day.",
      link: "/sell/pending",
    }, { email: true });
    await notify(await adminIds(), { type: "APPLICATION_SUBMITTED", title: "New seller application", body: `${parsed.data.fullName} applied to sell.`, link: "/admin/applications" });
    redirect("/sell/pending");
  });
}

export async function forgotPasswordAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await rateLimit(`forgot:${await clientIp()}`, 5, 15 * 60);
    const parsed = forgotPasswordSchema.safeParse(formObject(fd));
    if (!parsed.success) return fail(parsed.error);
    const id = parsed.data.identifier.toLowerCase();
    const phone = normalizeKenyanPhone(id);
    const user = await db.user.findFirst({ where: phone ? { OR: [{ email: id }, { phone }] } : { email: id } });
    const generic = { ok: true, message: "If an account exists, we've sent a reset link by email and SMS." };
    if (!user || user.status !== "ACTIVE") return generic;

    const token = randomBytes(32).toString("hex");
    await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60_000) } });
    const link = `/reset-password?token=${token}`;
    await sendEmail(user.email, "Reset your 2ndHandGuru password", "Use the link below to choose a new password. It expires in 1 hour. If you didn't request this, ignore this email.", link).catch(console.error);
    const { config } = await import("@/lib/config");
    await smsProvider().send(user.phone, `2ndHandGuru password reset: ${config.appUrl}${link} (expires in 1h)`).catch(console.error);
    return generic;
  });
}

export async function resetPasswordAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await rateLimit(`reset:${await clientIp()}`, 10, 15 * 60);
    const parsed = resetPasswordSchema.safeParse(formObject(fd));
    if (!parsed.success) return fail(parsed.error);
    const record = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(parsed.data.token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) return { error: "This reset link is invalid or has expired. Request a new one." };
    await db.$transaction([
      db.user.update({ where: { id: record.userId }, data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) } }),
      db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      db.passwordResetToken.deleteMany({ where: { userId: record.userId, usedAt: null } }),
    ]);
    redirect("/login?reset=1");
  });
}

export async function changePasswordAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser("/account/settings");
    await rateLimit(`chpw:${user.id}`, 10, 15 * 60);
    const parsed = changePasswordSchema.safeParse(formObject(fd));
    if (!parsed.success) return fail(parsed.error);
    if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
      return { error: "Please fix the highlighted fields.", fieldErrors: { currentPassword: ["Current password is incorrect"] } };
    }
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) } });
    return { ok: true, message: "Password updated." };
  });
}

export async function updateProfileAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser("/account/settings");
    const parsed = profileSchema.safeParse(formObject(fd));
    if (!parsed.success) return fail(parsed.error);
    const clash = await db.user.findFirst({ where: { phone: parsed.data.phone, id: { not: user.id } } });
    if (clash) return { error: "Please fix the highlighted fields.", fieldErrors: { phone: ["Phone already in use"] } };
    await db.user.update({ where: { id: user.id }, data: { name: parsed.data.name, phone: parsed.data.phone, county: parsed.data.county ?? null } });
    revalidatePath("/", "layout");
    return { ok: true, message: "Profile saved." };
  });
}

export async function markNotificationsReadAction(): Promise<void> {
  const user = await requireUser("/account/notifications");
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

export async function contactAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await rateLimit(`contact:${await clientIp()}`, 5, 60 * 60);
    const parsed = contactSchema.safeParse(formObject(fd));
    if (!parsed.success) return fail(parsed.error);
    await notify(await adminIds(), { type: "APPLICATION_SUBMITTED", title: `Contact form: ${parsed.data.name}`, body: `${parsed.data.email}: ${parsed.data.message}` });
    return { ok: true, message: "Thanks — we'll get back to you within one business day." };
  });
}

export async function sellerSettingsAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const { requireApprovedSeller } = await import("@/lib/session");
    const { sellerSettingsSchema } = await import("@/lib/validators");
    const user = await requireApprovedSeller();
    const parsed = sellerSettingsSchema.safeParse(formObject(fd));
    if (!parsed.success) return fail(parsed.error);
    const clash = await db.user.findFirst({ where: { phone: parsed.data.phone, id: { not: user.id } } });
    if (clash) return { error: "Please fix the highlighted fields.", fieldErrors: { phone: ["Phone already in use"] } };
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { name: parsed.data.name, phone: parsed.data.phone, county: parsed.data.county ?? null, mpesaPayoutPhone: parsed.data.mpesaPayoutPhone },
      }),
      db.sellerProfile.update({ where: { userId: user.id }, data: { businessName: parsed.data.businessName ?? null, description: parsed.data.description } }),
    ]);
    revalidatePath("/seller/settings");
    return { ok: true, message: "Settings saved. Future payouts will go to the new M-Pesa number." };
  });
}
