"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, requireApprovedSeller } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { realFiles, saveImageUpload } from "@/lib/storage";
import { isMockMpesa, mockStkCallback, stkQuery } from "@/lib/mpesa";
import {
  addDisputeEvidence,
  cancelOrder,
  confirmReceipt,
  createOrder,
  EscrowError,
  handleStkCallback,
  initiatePayment,
  markDispatched,
  openDispute,
} from "@/lib/escrow";
import {
  type ActionResult,
  checkoutSchema,
  disputeSchema,
  dispatchSchema,
  evidenceSchema,
  fail,
  formObject,
  phoneSchema,
  reasonSchema,
} from "@/lib/validators";
import { safeAction } from "./utils";

export async function checkoutAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser("/listings");
    await rateLimit(`pay:${user.id}`, 6, 10 * 60);
    const parsed = checkoutSchema.safeParse(formObject(fd));
    if (!parsed.success) return fail(parsed.error);
    const order = await createOrder({ buyerId: user.id, ...parsed.data });
    await initiatePayment(order.id, user.id, parsed.data.buyerPhone);
    redirect(`/account/orders/${order.id}?paying=1`);
  });
}

export async function retryPaymentAction(orderId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser(`/account/orders/${orderId}`);
    await rateLimit(`pay:${user.id}`, 6, 10 * 60);
    const phone = phoneSchema.safeParse(fd.get("phone") ?? "");
    if (!phone.success) return { error: "Please fix the highlighted fields.", fieldErrors: { phone: phone.error.issues.map((i) => i.message) } };
    const res = await initiatePayment(orderId, user.id, phone.data);
    revalidatePath(`/account/orders/${orderId}`);
    return { ok: true, message: res.message || "Check your phone and enter your M-Pesa PIN." };
  });
}

/** Polls Daraja for the latest STK result (for environments where callbacks can't reach the app). */
export async function checkPaymentStatusAction(orderId: string): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser(`/account/orders/${orderId}`);
    await rateLimit(`stkq:${user.id}`, 20, 10 * 60);
    const payment = await db.payment.findFirst({ where: { orderId, order: { buyerId: user.id }, status: "PENDING" }, orderBy: { createdAt: "desc" } });
    if (!payment?.checkoutRequestId) return { ok: true, message: "No pending payment." };
    const res = await stkQuery(payment.checkoutRequestId);
    if (!res) return { ok: true, message: "Still waiting for M-Pesa confirmation." };
    if (res.resultCode !== 0) {
      await handleStkCallback({ Body: { stkCallback: { MerchantRequestID: payment.merchantRequestId ?? "", CheckoutRequestID: payment.checkoutRequestId, ResultCode: res.resultCode, ResultDesc: res.resultDesc } } }, "stk-query");
    }
    revalidatePath(`/account/orders/${orderId}`);
    return { ok: true, message: res.resultCode === 0 ? "Payment confirmed by M-Pesa — waiting for the callback receipt." : res.resultDesc };
  });
}

/** Development-only: simulates the Daraja STK callback when MPESA_MODE=mock. */
export async function simulatePaymentAction(orderId: string, success: boolean): Promise<ActionResult> {
  return safeAction(async () => {
    if (!isMockMpesa()) return { error: "Simulation is only available in mock mode." };
    const user = await requireUser(`/account/orders/${orderId}`);
    const payment = await db.payment.findFirst({ where: { orderId, order: { buyerId: user.id }, status: "PENDING" }, orderBy: { createdAt: "desc" } });
    if (!payment?.checkoutRequestId) return { error: "No pending payment to simulate." };
    await handleStkCallback(mockStkCallback(payment.checkoutRequestId, payment.amount, payment.phone, success), "mock");
    revalidatePath(`/account/orders/${orderId}`);
    return { ok: true, message: success ? "Payment simulated." : "Failed payment simulated." };
  });
}

export async function dispatchAction(orderId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser(`/seller/orders/${orderId}`);
    const isAdmin = user.role === "ADMIN";
    if (!isAdmin) await requireApprovedSeller();
    const parsed = dispatchSchema.safeParse(formObject(fd));
    if (!parsed.success) return fail(parsed.error);
    if (isAdmin) {
      const order = await db.order.findUnique({ where: { id: orderId }, include: { seller: { include: { sellerProfile: true } } } });
      if (!order?.seller.sellerProfile?.isPlatform) throw new EscrowError("Admins can only dispatch platform-owned orders.");
    }
    await markDispatched(orderId, user.id, parsed.data.courier, parsed.data.trackingNote, isAdmin);
    revalidatePath(`/seller/orders/${orderId}`);
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, message: "Marked as dispatched. The buyer has been notified." };
  });
}

export async function confirmReceiptAction(orderId: string): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser(`/account/orders/${orderId}`);
    await confirmReceipt(orderId, user.id);
    revalidatePath(`/account/orders/${orderId}`);
    return { ok: true, message: "Thanks! Funds have been released to the seller." };
  });
}

export async function cancelOrderAction(orderId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser(`/account/orders/${orderId}`);
    const parsed = reasonSchema.safeParse({ reason: fd.get("reason") || "Cancelled by buyer" });
    if (!parsed.success) return fail(parsed.error);
    await cancelOrder(orderId, user.id, parsed.data.reason);
    revalidatePath(`/account/orders/${orderId}`);
    return { ok: true, message: "Order cancelled." };
  });
}

export async function openDisputeAction(orderId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser(`/account/orders/${orderId}`);
    await rateLimit(`dispute:${user.id}`, 5, 60 * 60);
    const parsed = disputeSchema.safeParse(formObject(fd));
    if (!parsed.success) return fail(parsed.error);
    const files = realFiles(fd.getAll("photos")).slice(0, 6);
    const keys: string[] = [];
    for (const f of files) keys.push(await saveImageUpload(f, `private/disputes/${orderId}`));
    await openDispute({ orderId, buyerId: user.id, reason: parsed.data.reason, note: parsed.data.note, imageKeys: keys });
    revalidatePath(`/account/orders/${orderId}`);
    return { ok: true, message: "Dispute opened. Funds are frozen until our team reviews it." };
  });
}

export async function addEvidenceAction(disputeId: string, orderId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await requireUser("/account/orders");
    const parsed = evidenceSchema.safeParse(formObject(fd));
    if (!parsed.success) return fail(parsed.error);
    const files = realFiles(fd.getAll("photos")).slice(0, 6);
    const keys: string[] = [];
    for (const f of files) keys.push(await saveImageUpload(f, `private/disputes/${orderId}`));
    await addDisputeEvidence(disputeId, user.id, parsed.data.note, keys);
    revalidatePath(`/account/orders/${orderId}`);
    revalidatePath(`/seller/orders/${orderId}`);
    return { ok: true, message: "Evidence added." };
  });
}
