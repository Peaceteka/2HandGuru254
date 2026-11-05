import "server-only";
import nodemailer from "nodemailer";
import { config } from "./config";
import { db } from "./db";

export type NotificationType =
  | "APPLICATION_SUBMITTED"
  | "APPLICATION_APPROVED"
  | "APPLICATION_REJECTED"
  | "PAYMENT_HELD"
  | "ORDER_DISPATCHED"
  | "FUNDS_RELEASED"
  | "ORDER_REFUNDED"
  | "ORDER_CANCELLED"
  | "DISPUTE_OPENED"
  | "DISPUTE_RESOLVED"
  | "PASSWORD_RESET"
  | "ACCOUNT_SUSPENDED";

type Payload = { type: NotificationType; title: string; body: string; link?: string };
type Channels = { email?: boolean; sms?: boolean; inApp?: boolean };

// ---- Email ----
let transporter: nodemailer.Transporter | null = null;
function mailer() {
  if (!config.email.host) return null;
  transporter ??= nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: config.email.user ? { user: config.email.user, pass: config.email.pass } : undefined,
  });
  return transporter;
}

export async function sendEmail(to: string, subject: string, text: string, link?: string) {
  const url = link ? (link.startsWith("http") ? link : `${config.appUrl}${link}`) : undefined;
  const fullText = url ? `${text}\n\n${url}` : text;
  const t = mailer();
  if (!t) {
    console.info(`[email:console] to=${to} subject="${subject}"\n${fullText}`);
    return;
  }
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;color:#111">
    <p style="font-size:20px;font-weight:700"><span style="color:#F5B800">2nd</span>HandGuru</p>
    <h2 style="font-size:18px">${escapeHtml(subject)}</h2>
    <p style="line-height:1.6">${escapeHtml(text).replace(/\n/g, "<br>")}</p>
    ${url ? `<p><a href="${url}" style="display:inline-block;background:#F5B800;color:#111;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Open 2ndHandGuru</a></p>` : ""}
    <p style="color:#666;font-size:12px">You are receiving this because you have an account on 2ndHandGuru.</p></div>`;
  await t.sendMail({ from: config.email.from, to, subject, text: fullText, html });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// ---- SMS (provider abstraction) ----
export interface SmsProvider {
  send(to: string, message: string): Promise<void>;
}

const consoleSms: SmsProvider = {
  async send(to, message) {
    console.info(`[sms:console] to=${to} ${message}`);
  },
};

const africasTalking: SmsProvider = {
  async send(to, message) {
    const sandbox = config.sms.atUsername === "sandbox";
    const url = sandbox
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging";
    const body = new URLSearchParams({ username: config.sms.atUsername, to: `+${to}`, message });
    if (config.sms.atSenderId) body.set("from", config.sms.atSenderId);
    const res = await fetch(url, {
      method: "POST",
      headers: { apiKey: config.sms.atApiKey, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`Africa's Talking SMS failed (${res.status})`);
  },
};

export function smsProvider(): SmsProvider {
  return config.sms.provider === "africastalking" ? africasTalking : consoleSms;
}

// ---- Fan-out ----
/** Never throws: notification delivery must not break escrow operations. */
export async function notify(userIds: string | string[], payload: Payload, channels: Channels = { email: true }) {
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])];
  const { inApp = true, email = false, sms = false } = channels;
  try {
    const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, phone: true } });
    if (inApp) {
      await db.notification.createMany({
        data: users.map((u) => ({ userId: u.id, type: payload.type, title: payload.title, body: payload.body, link: payload.link })),
      });
    }
    await Promise.allSettled(
      users.flatMap((u) => [
        email ? sendEmail(u.email, payload.title, payload.body, payload.link) : Promise.resolve(),
        sms ? smsProvider().send(u.phone, `2ndHandGuru: ${payload.title}. ${payload.body}`.slice(0, 300)) : Promise.resolve(),
      ]),
    ).then((results) => results.forEach((r) => r.status === "rejected" && console.error("[notify]", r.reason)));
  } catch (err) {
    console.error("[notify] failed", err);
  }
}

export async function adminIds() {
  const admins = await db.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
  return admins.map((a) => a.id);
}
