import "server-only";
import { randomBytes, randomUUID } from "crypto";
import type { Order, OrderStatus, Prisma } from "@prisma/client";
import { db } from "./db";
import { postLedger } from "./ledger";
import { getSettings } from "./settings";
import { config } from "./config";
import { formatKES } from "./format";
import { adminIds, notify } from "./notifications";
import {
  b2cPayment,
  isMockMpesa,
  mockB2CResult,
  parseB2CResult,
  parseStkCallback,
  stkPush,
  type B2CResultPayload,
  type StkCallbackPayload,
} from "./mpesa";

/**
 * Escrow order state machine.
 *
 *   PENDING_PAYMENT → PAID_HELD → DISPATCHED → DELIVERED_CONFIRMED → RELEASED
 *   PENDING_PAYMENT → CANCELLED                      (unpaid / timed out)
 *   PAID_HELD       → CANCELLED (+ refund)           (seller missed the dispatch window, or item unavailable)
 *   PAID_HELD       → REFUNDED                       (admin refund)
 *   DISPATCHED      → DISPUTED → RELEASED | REFUNDED (admin resolution)
 *   DISPATCHED      → RELEASED                       (auto-release after N days, or admin)
 */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID_HELD", "CANCELLED"],
  PAID_HELD: ["DISPATCHED", "CANCELLED", "REFUNDED", "RELEASED"],
  DISPATCHED: ["DELIVERED_CONFIRMED", "DISPUTED", "RELEASED", "REFUNDED"],
  DELIVERED_CONFIRMED: ["RELEASED"],
  DISPUTED: ["RELEASED", "REFUNDED"],
  RELEASED: [],
  REFUNDED: [],
  CANCELLED: [],
};

export class EscrowError extends Error {}

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return TRANSITIONS[from].includes(to);
}

type Actor = { id: string | null; label?: string };

async function transition(
  tx: Prisma.TransactionClient,
  order: Pick<Order, "id" | "status">,
  to: OrderStatus,
  actor: Actor,
  note?: string,
  data: Prisma.OrderUpdateManyMutationInput = {},
) {
  if (!canTransition(order.status, to)) {
    throw new EscrowError(`Order cannot move from ${order.status} to ${to}.`);
  }
  // Optimistic concurrency: only succeeds if nobody changed the status in the meantime.
  const res = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data: { ...data, status: to } });
  if (res.count !== 1) throw new EscrowError("This order was updated by someone else. Please refresh and try again.");
  await tx.orderEvent.create({
    data: { orderId: order.id, fromStatus: order.status, toStatus: to, actorId: actor.id, note },
  });
}

function orderCode() {
  return `GURU-${randomBytes(4).toString("hex").toUpperCase()}`;
}

const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 3600_000);
const addDays = (d: Date, days: number) => addHours(d, days * 24);

// ---------------------------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------------------------

export async function createOrder(input: {
  buyerId: string;
  listingId: string;
  buyerPhone: string;
  deliveryCounty: string;
  deliveryTown: string;
  deliveryAddress: string;
  deliveryNotes?: string;
}) {
  const settings = await getSettings();
  const listing = await db.listing.findUnique({ where: { id: input.listingId }, include: { seller: true } });
  if (!listing || listing.status !== "ACTIVE") throw new EscrowError("This item is no longer available.");
  if (listing.sellerId === input.buyerId) throw new EscrowError("You cannot buy your own listing.");
  if (listing.seller.status !== "ACTIVE") throw new EscrowError("This seller is currently unavailable.");

  const existing = await db.order.findFirst({
    where: { buyerId: input.buyerId, listingId: listing.id, status: "PENDING_PAYMENT" },
  });
  if (existing) return existing;

  const commissionBps = Math.round(settings.commissionPercent * 100);
  const platformFee = Math.round((listing.price * commissionBps) / 10_000);
  const order = await db.order.create({
    data: {
      code: orderCode(),
      buyerId: input.buyerId,
      sellerId: listing.sellerId,
      listingId: listing.id,
      amount: listing.price,
      commissionBps,
      platformFee,
      sellerAmount: listing.price - platformFee,
      buyerPhone: input.buyerPhone,
      deliveryCounty: input.deliveryCounty,
      deliveryTown: input.deliveryTown,
      deliveryAddress: input.deliveryAddress,
      deliveryNotes: input.deliveryNotes,
      events: { create: { toStatus: "PENDING_PAYMENT", actorId: input.buyerId, note: "Order created" } },
    },
  });
  return order;
}

/** Sends an STK Push prompt for an order awaiting payment. */
export async function initiatePayment(orderId: string, buyerId: string, phone?: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.buyerId !== buyerId) throw new EscrowError("Order not found.");
  if (order.status !== "PENDING_PAYMENT") throw new EscrowError("This order is not awaiting payment.");
  const listing = await db.listing.findUnique({ where: { id: order.listingId } });
  if (listing?.status !== "ACTIVE") throw new EscrowError("This item is no longer available.");

  const payPhone = phone ?? order.buyerPhone;
  const payment = await db.payment.create({ data: { orderId, phone: payPhone, amount: order.amount } });
  try {
    const res = await stkPush({
      phone: payPhone,
      amount: order.amount,
      accountReference: order.code.replace("GURU-", "GURU"),
      description: "Escrow pay",
    });
    await db.payment.update({
      where: { id: payment.id },
      data: { merchantRequestId: res.merchantRequestId, checkoutRequestId: res.checkoutRequestId },
    });
    if (phone && phone !== order.buyerPhone) await db.order.update({ where: { id: orderId }, data: { buyerPhone: phone } });
    return { paymentId: payment.id, message: res.customerMessage };
  } catch (err) {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", resultDesc: err instanceof Error ? err.message : "STK push failed" },
    });
    throw new EscrowError("We couldn't reach M-Pesa. Please try again in a moment.");
  }
}

// ---------------------------------------------------------------------------------------------
// M-Pesa callbacks (idempotent)
// ---------------------------------------------------------------------------------------------

export async function handleStkCallback(payload: StkCallbackPayload, remoteIp?: string) {
  const parsed = parseStkCallback(payload);
  const log = await db.mpesaCallbackLog.create({
    data: { kind: "STK", externalId: parsed?.checkoutRequestId, payload: payload as Prisma.InputJsonValue, remoteIp },
  });
  if (!parsed) {
    await db.mpesaCallbackLog.update({ where: { id: log.id }, data: { note: "Unparseable payload" } });
    return;
  }

  const payment = await db.payment.findUnique({ where: { checkoutRequestId: parsed.checkoutRequestId } });
  if (!payment) {
    await db.mpesaCallbackLog.update({ where: { id: log.id }, data: { note: "Unknown CheckoutRequestID" } });
    return;
  }

  const success = parsed.resultCode === 0;
  type Outcome = "duplicate" | "failed" | "held" | "late-refund" | "unavailable-refund" | "amount-mismatch";
  let outcome = "failed" as Outcome;
  const settings = await getSettings();

  await db.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: {
        status: success ? "SUCCESS" : "FAILED",
        resultCode: parsed.resultCode,
        resultDesc: parsed.resultDesc,
        mpesaReceipt: parsed.receipt,
      },
    });
    if (claimed.count === 0) {
      outcome = "duplicate";
      return;
    }
    if (!success) return;

    const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });
    const received = parsed.amount ?? payment.amount;

    await postLedger(tx, order.id, "PAYMENT_HELD", payment.id, `M-Pesa ${parsed.receipt ?? ""} received for ${order.code}`, [
      { account: "MPESA_CLEARING", debit: received },
      { account: "ESCROW_HELD", credit: received, userId: order.buyerId },
    ]);

    if (order.status !== "PENDING_PAYMENT") {
      // Payment arrived after the order was cancelled/expired or already paid — refund this payment.
      outcome = "late-refund";
      await refundInTx(tx, order, { id: null }, "Payment received after order was closed or already paid", {
        amount: received,
        key: payment.id,
        phone: parsed.phone ?? payment.phone,
      });
      return;
    }

    if (received !== order.amount) {
      outcome = "amount-mismatch";
      const reason = `Amount mismatch: received ${received}, expected ${order.amount}`;
      await transition(tx, order, "CANCELLED", { id: null }, reason, { cancelledAt: new Date(), cancelReason: reason });
      await refundInTx(tx, { ...order, status: "CANCELLED" }, { id: null }, reason, { amount: received, key: payment.id });
      return;
    }

    const now = new Date();
    await transition(tx, order, "PAID_HELD", { id: null, label: "M-Pesa" }, `Paid via M-Pesa ${parsed.receipt ?? ""}`.trim(), {
      paidAt: now,
      dispatchDeadline: addHours(now, settings.dispatchWindowHours),
    });

    const reserved = await tx.listing.updateMany({ where: { id: order.listingId, status: "ACTIVE" }, data: { status: "RESERVED" } });
    if (reserved.count === 0) {
      outcome = "unavailable-refund";
      await cancelWithRefundInTx(tx, { ...order, status: "PAID_HELD" }, { id: null }, "Item was bought by another buyer first");
      return;
    }
    outcome = "held";
  });

  await db.mpesaCallbackLog.update({ where: { id: log.id }, data: { processed: outcome !== "duplicate", note: outcome } });

  const order = await db.order.findUniqueOrThrow({ where: { id: payment.orderId }, include: { listing: true } });
  if (outcome === "held") {
    await notify(order.buyerId, {
      type: "PAYMENT_HELD",
      title: "Payment received and held in escrow",
      body: `${formatKES(order.amount)} for "${order.listing.title}" is safely held. The seller has been asked to dispatch.`,
      link: `/account/orders/${order.id}`,
    }, { email: true, sms: true });
    await notify(order.sellerId, {
      type: "PAYMENT_HELD",
      title: "New paid order — please dispatch",
      body: `The buyer paid ${formatKES(order.amount)} for "${order.listing.title}" (held in escrow). Dispatch within ${settings.dispatchWindowHours} hours.`,
      link: `/seller/orders/${order.id}`,
    }, { email: true, sms: true });
  }
  if (["late-refund", "unavailable-refund", "amount-mismatch"].includes(outcome)) {
    await dispatchPendingPayouts(order.id);
    await notify(order.buyerId, {
      type: "ORDER_REFUNDED",
      title: "Your payment is being refunded",
      body: `We couldn't complete order ${order.code}, so ${formatKES(order.amount)} is being refunded to your M-Pesa.`,
      link: `/account/orders/${order.id}`,
    }, { email: true, sms: true });
  }
  return outcome;
}

export async function handleB2CResult(payload: B2CResultPayload, remoteIp?: string) {
  const parsed = parseB2CResult(payload);
  const log = await db.mpesaCallbackLog.create({
    data: { kind: "B2C_RESULT", externalId: parsed?.originatorConversationId, payload: payload as Prisma.InputJsonValue, remoteIp },
  });
  if (!parsed) return;
  const payout = await db.payout.findUnique({ where: { originatorConversationId: parsed.originatorConversationId } });
  if (!payout) {
    await db.mpesaCallbackLog.update({ where: { id: log.id }, data: { note: "Unknown OriginatorConversationID" } });
    return;
  }
  const success = parsed.resultCode === 0;
  let processed = false;
  await db.$transaction(async (tx) => {
    const claimed = await tx.payout.updateMany({
      where: { id: payout.id, status: "PENDING" },
      data: {
        status: success ? "SUCCESS" : "FAILED",
        resultCode: parsed.resultCode,
        resultDesc: parsed.resultDesc,
        transactionId: parsed.transactionId,
        conversationId: parsed.conversationId,
      },
    });
    if (claimed.count === 0 || !success) {
      processed = claimed.count > 0;
      return;
    }
    processed = true;
    if (payout.type === "SELLER_PAYOUT") {
      await postLedger(tx, payout.orderId, "SELLER_PAYOUT_SENT", payout.id, `B2C ${parsed.transactionId ?? ""} to seller`, [
        { account: "SELLER_PAYABLE", debit: payout.amount, userId: payout.userId },
        { account: "MPESA_CLEARING", credit: payout.amount },
      ]);
    } else {
      await postLedger(tx, payout.orderId, "BUYER_REFUND_SENT", payout.id, `B2C ${parsed.transactionId ?? ""} refund to buyer`, [
        { account: "REFUNDS_PAYABLE", debit: payout.amount, userId: payout.userId },
        { account: "MPESA_CLEARING", credit: payout.amount },
      ]);
    }
  });
  await db.mpesaCallbackLog.update({ where: { id: log.id }, data: { processed, note: success ? "success" : "failed" } });
  if (!success && processed) {
    await notify(await adminIds(), {
      type: payout.type === "SELLER_PAYOUT" ? "FUNDS_RELEASED" : "ORDER_REFUNDED",
      title: "M-Pesa B2C payout failed",
      body: `Payout ${payout.originatorConversationId} (${formatKES(payout.amount)}) failed: ${parsed.resultDesc}. Retry from the order page.`,
      link: `/admin/orders/${payout.orderId}`,
    });
  }
}

export async function handleB2CTimeout(payload: unknown, remoteIp?: string) {
  const id = (payload as B2CResultPayload)?.Result?.OriginatorConversationID;
  await db.mpesaCallbackLog.create({
    data: { kind: "B2C_TIMEOUT", externalId: id, payload: payload as Prisma.InputJsonValue, remoteIp, note: "queue timeout" },
  });
}

// ---------------------------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------------------------

/** Sends B2C requests for any PENDING payout on an order that hasn't been submitted yet. */
export async function dispatchPendingPayouts(orderId: string) {
  const payouts = await db.payout.findMany({ where: { orderId, status: "PENDING", conversationId: null } });
  for (const p of payouts) {
    try {
      const res = await b2cPayment({
        originatorConversationId: p.originatorConversationId,
        phone: p.phone,
        amount: p.amount,
        remarks: p.type === "SELLER_PAYOUT" ? "2ndHandGuru escrow release" : "2ndHandGuru escrow refund",
        occasion: orderId,
      });
      await db.payout.update({ where: { id: p.id }, data: { conversationId: res.conversationId } });
      if (isMockMpesa()) await handleB2CResult(mockB2CResult(p.originatorConversationId, res.conversationId), "mock");
    } catch (err) {
      await db.payout.update({
        where: { id: p.id },
        data: { status: "FAILED", resultDesc: err instanceof Error ? err.message : "B2C request failed" },
      });
    }
  }
}

export async function retryPayout(payoutId: string, adminId: string) {
  const payout = await db.payout.findUnique({ where: { id: payoutId } });
  if (!payout || payout.status !== "FAILED") throw new EscrowError("Only failed payouts can be retried.");
  await db.payout.update({
    where: { id: payoutId },
    data: { status: "PENDING", originatorConversationId: randomUUID(), conversationId: null, resultCode: null, resultDesc: null },
  });
  await db.auditLog.create({
    data: { actorId: adminId, action: "payout.retry", entityType: "Payout", entityId: payoutId, details: { orderId: payout.orderId } },
  });
  await dispatchPendingPayouts(payout.orderId);
}

// ---------------------------------------------------------------------------------------------
// Release & refund primitives (run inside a transaction)
// ---------------------------------------------------------------------------------------------

async function releaseInTx(tx: Prisma.TransactionClient, order: Order, actor: Actor, note: string) {
  await transition(tx, order, "RELEASED", actor, note, { releasedAt: new Date() });
  await postLedger(tx, order.id, "ESCROW_RELEASE", order.id, `Escrow released for ${order.code}`, [
    { account: "ESCROW_HELD", debit: order.amount, userId: order.buyerId },
    { account: "SELLER_PAYABLE", credit: order.sellerAmount, userId: order.sellerId },
    { account: "PLATFORM_FEE", credit: order.platformFee },
  ]);
  await tx.listing.update({ where: { id: order.listingId }, data: { status: "SOLD" } });

  const seller = await tx.user.findUniqueOrThrow({ where: { id: order.sellerId }, include: { sellerProfile: true } });
  const isPlatform = seller.sellerProfile?.isPlatform ?? false;
  await tx.payout.create({
    data: {
      orderId: order.id,
      userId: order.sellerId,
      type: "SELLER_PAYOUT",
      phone: seller.mpesaPayoutPhone ?? seller.phone,
      amount: order.sellerAmount,
      status: isPlatform ? "INTERNAL" : "PENDING",
      originatorConversationId: randomUUID(),
      resultDesc: isPlatform ? "Platform-owned listing: retained internally" : null,
    },
  });
}

async function refundInTx(
  tx: Prisma.TransactionClient,
  order: Order,
  actor: Actor,
  note: string,
  opts: { amount?: number; key?: string; phone?: string } = {},
) {
  const amount = opts.amount ?? order.amount;
  const isExtraPayment = Boolean(opts.key);
  await postLedger(tx, order.id, "ESCROW_REFUND", opts.key ?? order.id, `Escrow refunded for ${order.code}: ${note}`, [
    { account: "ESCROW_HELD", debit: amount, userId: order.buyerId },
    { account: "REFUNDS_PAYABLE", credit: amount, userId: order.buyerId },
  ]);
  await tx.payout.create({
    data: {
      orderId: order.id,
      userId: order.buyerId,
      type: "BUYER_REFUND",
      phone: opts.phone ?? order.buyerPhone,
      amount,
      originatorConversationId: randomUUID(),
    },
  });
  if (isExtraPayment && order.status !== "CANCELLED") {
    await tx.orderEvent.create({ data: { orderId: order.id, fromStatus: order.status, toStatus: order.status, actorId: actor.id, note: `Duplicate payment refunded: ${note}` } });
    return;
  }
  await tx.order.update({ where: { id: order.id }, data: { refundedAt: new Date() } });
  if (isExtraPayment) {
    await tx.orderEvent.create({ data: { orderId: order.id, fromStatus: "CANCELLED", toStatus: "CANCELLED", actorId: actor.id, note: `Refund issued: ${note}` } });
  }
  const otherHolder = await tx.order.count({
    where: {
      listingId: order.listingId,
      id: { not: order.id },
      status: { in: ["PAID_HELD", "DISPATCHED", "DELIVERED_CONFIRMED", "DISPUTED", "RELEASED"] },
    },
  });
  if (otherHolder === 0) {
    await tx.listing.updateMany({ where: { id: order.listingId, status: "RESERVED" }, data: { status: "ACTIVE" } });
  }
}

async function cancelWithRefundInTx(tx: Prisma.TransactionClient, order: Order, actor: Actor, reason: string) {
  await transition(tx, order, "CANCELLED", actor, reason, { cancelledAt: new Date(), cancelReason: reason });
  await refundInTx(tx, { ...order, status: "PAID_HELD" }, actor, reason);
}

async function loadOrder(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { listing: true } });
  if (!order) throw new EscrowError("Order not found.");
  return order;
}

// ---------------------------------------------------------------------------------------------
// Participant actions
// ---------------------------------------------------------------------------------------------

export async function markDispatched(orderId: string, sellerId: string, courier: string, trackingNote: string, actorIsAdmin = false) {
  const order = await loadOrder(orderId);
  if (!actorIsAdmin && order.sellerId !== sellerId) throw new EscrowError("Order not found.");
  const settings = await getSettings();
  const now = new Date();
  await db.$transaction((tx) =>
    transition(tx, order, "DISPATCHED", { id: sellerId }, `Dispatched via ${courier}${trackingNote ? ` — ${trackingNote}` : ""}`, {
      dispatchedAt: now,
      courier,
      trackingNote,
      autoReleaseAt: addDays(now, settings.autoReleaseDays),
    }),
  );
  await notify(order.buyerId, {
    type: "ORDER_DISPATCHED",
    title: "Your item has been dispatched",
    body: `"${order.listing.title}" is on its way via ${courier}. Confirm receipt once it arrives, or raise a dispute within ${settings.autoReleaseDays} days.`,
    link: `/account/orders/${order.id}`,
  }, { email: true, sms: true });
}

export async function confirmReceipt(orderId: string, buyerId: string) {
  const order = await loadOrder(orderId);
  if (order.buyerId !== buyerId) throw new EscrowError("Order not found.");
  await db.$transaction(async (tx) => {
    await transition(tx, order, "DELIVERED_CONFIRMED", { id: buyerId }, "Buyer confirmed receipt", { deliveredAt: new Date() });
    await releaseInTx(tx, { ...order, status: "DELIVERED_CONFIRMED" }, { id: null }, "Funds released after buyer confirmation");
  });
  await afterRelease(order.id);
}

export async function cancelOrder(orderId: string, actorId: string, reason: string, actorIsAdmin = false) {
  const order = await loadOrder(orderId);
  if (!actorIsAdmin && order.buyerId !== actorId) throw new EscrowError("Order not found.");
  if (order.status === "PENDING_PAYMENT") {
    await db.$transaction(async (tx) => {
      await transition(tx, order, "CANCELLED", { id: actorId }, reason, { cancelledAt: new Date(), cancelReason: reason });
    });
    return;
  }
  if (order.status !== "PAID_HELD") throw new EscrowError("This order can no longer be cancelled.");
  if (!actorIsAdmin && order.dispatchDeadline && order.dispatchDeadline > new Date()) {
    throw new EscrowError("The seller still has time to dispatch. You can cancel once the dispatch window has passed.");
  }
  await db.$transaction((tx) => cancelWithRefundInTx(tx, order, { id: actorId }, reason));
  await afterRefund(order.id, reason);
}

export async function openDispute(input: {
  orderId: string;
  buyerId: string;
  reason: Prisma.DisputeCreateInput["reason"];
  note: string;
  imageKeys: string[];
}) {
  const order = await loadOrder(input.orderId);
  if (order.buyerId !== input.buyerId) throw new EscrowError("Order not found.");
  const dispute = await db.$transaction(async (tx) => {
    await transition(tx, order, "DISPUTED", { id: input.buyerId }, `Dispute opened: ${input.reason}`);
    return tx.dispute.create({
      data: {
        orderId: order.id,
        openedById: input.buyerId,
        reason: input.reason,
        evidence: { create: { userId: input.buyerId, note: input.note, imageKeys: input.imageKeys } },
      },
    });
  });
  const body = `A dispute was opened on order ${order.code} ("${order.listing.title}"). Funds are frozen until an admin resolves it.`;
  await notify(order.sellerId, { type: "DISPUTE_OPENED", title: "A buyer raised a dispute", body: `${body} Add your evidence from the order page.`, link: `/seller/orders/${order.id}` }, { email: true, sms: true });
  await notify(order.buyerId, { type: "DISPUTE_OPENED", title: "Dispute opened", body, link: `/account/orders/${order.id}` }, { email: true });
  await notify(await adminIds(), { type: "DISPUTE_OPENED", title: "New dispute to review", body, link: `/admin/disputes/${dispute.id}` });
  return dispute;
}

export async function addDisputeEvidence(disputeId: string, userId: string, note: string, imageKeys: string[]) {
  const dispute = await db.dispute.findUnique({ where: { id: disputeId }, include: { order: true } });
  if (!dispute || (dispute.order.buyerId !== userId && dispute.order.sellerId !== userId)) throw new EscrowError("Dispute not found.");
  if (dispute.status !== "OPEN") throw new EscrowError("This dispute is already resolved.");
  await db.disputeEvidence.create({ data: { disputeId, userId, note, imageKeys } });
}

// ---------------------------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------------------------

export async function adminRelease(orderId: string, adminId: string, note: string) {
  const order = await loadOrder(orderId);
  if (order.status === "DISPUTED") throw new EscrowError("Resolve the dispute from the Disputes page.");
  await db.$transaction(async (tx) => {
    await releaseInTx(tx, order, { id: adminId }, `Manual release by admin: ${note}`);
    await tx.auditLog.create({ data: { actorId: adminId, action: "order.release", entityType: "Order", entityId: orderId, details: { note, from: order.status } } });
  });
  await afterRelease(order.id);
}

export async function adminRefund(orderId: string, adminId: string, note: string) {
  const order = await loadOrder(orderId);
  if (order.status === "DISPUTED") throw new EscrowError("Resolve the dispute from the Disputes page.");
  await db.$transaction(async (tx) => {
    await transition(tx, order, "REFUNDED", { id: adminId }, `Manual refund by admin: ${note}`);
    await refundInTx(tx, { ...order, status: "REFUNDED" }, { id: adminId }, note);
    await tx.auditLog.create({ data: { actorId: adminId, action: "order.refund", entityType: "Order", entityId: orderId, details: { note, from: order.status } } });
  });
  await afterRefund(order.id, note);
}

export async function resolveDispute(disputeId: string, adminId: string, outcome: "RELEASE" | "REFUND", note: string) {
  const dispute = await db.dispute.findUnique({ where: { id: disputeId }, include: { order: true } });
  if (!dispute || dispute.status !== "OPEN") throw new EscrowError("Dispute not found or already resolved.");
  const order = dispute.order;
  await db.$transaction(async (tx) => {
    const claimed = await tx.dispute.updateMany({
      where: { id: disputeId, status: "OPEN" },
      data: {
        status: outcome === "RELEASE" ? "RESOLVED_RELEASED" : "RESOLVED_REFUNDED",
        resolutionNote: note,
        resolvedById: adminId,
        resolvedAt: new Date(),
      },
    });
    if (claimed.count !== 1) throw new EscrowError("Dispute already resolved.");
    if (outcome === "RELEASE") {
      await releaseInTx(tx, order, { id: adminId }, `Dispute resolved in seller's favour: ${note}`);
    } else {
      await transition(tx, order, "REFUNDED", { id: adminId }, `Dispute resolved in buyer's favour: ${note}`);
      await refundInTx(tx, { ...order, status: "REFUNDED" }, { id: adminId }, note);
    }
    await tx.auditLog.create({
      data: { actorId: adminId, action: `dispute.resolve.${outcome.toLowerCase()}`, entityType: "Dispute", entityId: disputeId, details: { note, orderId: order.id } },
    });
  });
  await dispatchPendingPayouts(order.id);
  const title = outcome === "RELEASE" ? "Dispute resolved — funds released to seller" : "Dispute resolved — buyer refunded";
  const body = `Order ${order.code}: ${note}`;
  await notify(order.buyerId, { type: "DISPUTE_RESOLVED", title, body, link: `/account/orders/${order.id}` }, { email: true, sms: true });
  await notify(order.sellerId, { type: "DISPUTE_RESOLVED", title, body, link: `/seller/orders/${order.id}` }, { email: true, sms: true });
}

async function afterRelease(orderId: string) {
  await dispatchPendingPayouts(orderId);
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { listing: true } });
  await notify(order.sellerId, {
    type: "FUNDS_RELEASED",
    title: "Funds released to you",
    body: `${formatKES(order.sellerAmount)} for "${order.listing.title}" has been released to your M-Pesa (after ${formatKES(order.platformFee)} platform commission).`,
    link: `/seller/payouts`,
  }, { email: true, sms: true });
  await notify(order.buyerId, {
    type: "FUNDS_RELEASED",
    title: "Order complete",
    body: `Thanks for using escrow. Payment for "${order.listing.title}" has been released to the seller.`,
    link: `/account/orders/${order.id}`,
  });
}

async function afterRefund(orderId: string, reason: string) {
  await dispatchPendingPayouts(orderId);
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { listing: true } });
  await notify(order.buyerId, {
    type: "ORDER_REFUNDED",
    title: "Refund on its way",
    body: `${formatKES(order.amount)} for order ${order.code} is being refunded to your M-Pesa. Reason: ${reason}`,
    link: `/account/orders/${order.id}`,
  }, { email: true, sms: true });
  await notify(order.sellerId, {
    type: "ORDER_CANCELLED",
    title: "Order cancelled and refunded",
    body: `Order ${order.code} for "${order.listing.title}" was refunded to the buyer. Reason: ${reason}`,
    link: `/seller/orders/${order.id}`,
  }, { email: true });
}

// ---------------------------------------------------------------------------------------------
// Scheduled jobs
// ---------------------------------------------------------------------------------------------

export async function runEscrowJobs(now = new Date()) {
  const summary = { autoReleased: 0, expiredPending: 0, errors: [] as string[] };

  const due = await db.order.findMany({ where: { status: "DISPATCHED", autoReleaseAt: { lte: now } }, take: 200 });
  for (const order of due) {
    try {
      await db.$transaction((tx) => releaseInTx(tx, order, { id: null }, "Auto-released: buyer did not confirm or dispute in time"));
      await afterRelease(order.id);
      summary.autoReleased++;
    } catch (err) {
      summary.errors.push(`${order.code}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const cutoff = new Date(now.getTime() - config.escrow.pendingPaymentTimeoutMinutes * 60_000);
  const stale = await db.order.findMany({ where: { status: "PENDING_PAYMENT", createdAt: { lte: cutoff } }, take: 500 });
  for (const order of stale) {
    try {
      // Pending payments stay PENDING: if the buyer still completes the STK prompt, the callback refunds it.
      await db.$transaction((tx) =>
        transition(tx, order, "CANCELLED", { id: null }, "Payment not completed in time", { cancelledAt: now, cancelReason: "Payment timeout" }),
      );
      summary.expiredPending++;
    } catch (err) {
      summary.errors.push(`${order.code}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Retry B2C requests that were created but never submitted (e.g. app crashed mid-release).
  const unsent = await db.payout.findMany({
    where: { status: "PENDING", conversationId: null, createdAt: { lte: new Date(now.getTime() - 5 * 60_000) } },
    select: { orderId: true },
    distinct: ["orderId"],
  });
  for (const p of unsent) await dispatchPendingPayouts(p.orderId);

  return summary;
}
