import "server-only";
import { randomUUID } from "crypto";
import { config } from "./config";

/**
 * Safaricom Daraja client: STK Push (Lipa na M-Pesa Online) for collections and B2C for payouts/refunds.
 * MPESA_MODE=mock skips network calls so the full escrow flow can be exercised locally.
 */

const BASE_URL = config.mpesa.mode === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

export const isMockMpesa = () => config.mpesa.mode === "mock";

export class MpesaError extends Error {}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const auth = Buffer.from(`${config.mpesa.consumerKey}:${config.mpesa.consumerSecret}`).toString("base64");
  const res = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  if (!res.ok) throw new MpesaError(`Daraja auth failed (${res.status})`);
  const json = (await res.json()) as { access_token: string; expires_in: string };
  cachedToken = { token: json.access_token, expiresAt: Date.now() + Number(json.expires_in) * 1000 };
  return cachedToken.token;
}

async function darajaPost<T>(path: string, body: unknown): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { errorMessage?: string; ResponseCode?: string };
  if (!res.ok || (json.ResponseCode !== undefined && json.ResponseCode !== "0")) {
    throw new MpesaError(json.errorMessage || `Daraja request to ${path} failed (${res.status})`);
  }
  return json;
}

function timestamp() {
  // Daraja expects EAT (UTC+3) in yyyyMMddHHmmss
  const d = new Date(Date.now() + 3 * 3600_000);
  return d.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

function stkPassword(ts: string) {
  return Buffer.from(`${config.mpesa.shortcode}${config.mpesa.passkey}${ts}`).toString("base64");
}

function callbackUrl(path: string) {
  const token = config.mpesa.callbackSecret ? `?token=${encodeURIComponent(config.mpesa.callbackSecret)}` : "";
  return `${config.mpesa.callbackBaseUrl}${path}${token}`;
}

// Daraja rejects callback URLs containing words like "mpesa" or "safaricom", hence /api/payments/*.
export const CALLBACK_PATHS = {
  stk: "/api/payments/stk/callback",
  b2cResult: "/api/payments/b2c/result",
  b2cTimeout: "/api/payments/b2c/timeout",
};

export async function stkPush(input: { phone: string; amount: number; accountReference: string; description: string }) {
  if (isMockMpesa()) {
    return {
      merchantRequestId: `MOCK-MR-${randomUUID().slice(0, 8)}`,
      checkoutRequestId: `ws_CO_MOCK_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
      customerMessage: "Mock mode: use the simulate buttons to complete payment.",
    };
  }
  const ts = timestamp();
  const res = await darajaPost<{ MerchantRequestID: string; CheckoutRequestID: string; CustomerMessage: string }>(
    "/mpesa/stkpush/v1/processrequest",
    {
      BusinessShortCode: config.mpesa.shortcode,
      Password: stkPassword(ts),
      Timestamp: ts,
      TransactionType: config.mpesa.transactionType,
      Amount: Math.round(input.amount),
      PartyA: input.phone,
      PartyB: config.mpesa.shortcode,
      PhoneNumber: input.phone,
      CallBackURL: callbackUrl(CALLBACK_PATHS.stk),
      AccountReference: input.accountReference.slice(0, 12),
      TransactionDesc: input.description.slice(0, 13),
    },
  );
  return {
    merchantRequestId: res.MerchantRequestID,
    checkoutRequestId: res.CheckoutRequestID,
    customerMessage: res.CustomerMessage,
  };
}

/** Queries STK status; useful when the callback cannot reach the app (e.g. localhost). */
export async function stkQuery(checkoutRequestId: string) {
  if (isMockMpesa()) return null;
  const ts = timestamp();
  const token = await accessToken();
  const res = await fetch(`${BASE_URL}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: config.mpesa.shortcode,
      Password: stkPassword(ts),
      Timestamp: ts,
      CheckoutRequestID: checkoutRequestId,
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { ResultCode?: string; ResultDesc?: string; errorCode?: string };
  if (json.ResultCode === undefined) return null; // still processing or error
  return { resultCode: Number(json.ResultCode), resultDesc: json.ResultDesc ?? "" };
}

export async function b2cPayment(input: {
  originatorConversationId: string;
  phone: string;
  amount: number;
  remarks: string;
  occasion: string;
}) {
  if (isMockMpesa()) return { conversationId: `MOCK-CONV-${randomUUID().slice(0, 8)}` };
  const res = await darajaPost<{ ConversationID: string; OriginatorConversationID: string }>(
    "/mpesa/b2c/v3/paymentrequest",
    {
      OriginatorConversationID: input.originatorConversationId,
      InitiatorName: config.mpesa.initiatorName,
      SecurityCredential: config.mpesa.securityCredential,
      CommandID: "BusinessPayment",
      Amount: Math.round(input.amount),
      PartyA: config.mpesa.b2cShortcode,
      PartyB: input.phone,
      Remarks: input.remarks.slice(0, 100),
      QueueTimeOutURL: callbackUrl(CALLBACK_PATHS.b2cTimeout),
      ResultURL: callbackUrl(CALLBACK_PATHS.b2cResult),
      Occasion: input.occasion.slice(0, 100),
    },
  );
  return { conversationId: res.ConversationID };
}

// ---- Callback payload shapes ----

export type StkCallbackPayload = {
  Body?: {
    stkCallback?: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: { Item: { Name: string; Value?: string | number }[] };
    };
  };
};

export function parseStkCallback(payload: StkCallbackPayload) {
  const cb = payload?.Body?.stkCallback;
  if (!cb?.CheckoutRequestID) return null;
  const meta = Object.fromEntries((cb.CallbackMetadata?.Item ?? []).map((i) => [i.Name, i.Value]));
  return {
    checkoutRequestId: cb.CheckoutRequestID,
    resultCode: Number(cb.ResultCode),
    resultDesc: cb.ResultDesc,
    amount: meta.Amount !== undefined ? Number(meta.Amount) : undefined,
    receipt: meta.MpesaReceiptNumber ? String(meta.MpesaReceiptNumber) : undefined,
    phone: meta.PhoneNumber ? String(meta.PhoneNumber) : undefined,
  };
}

export type B2CResultPayload = {
  Result?: {
    ResultType?: number;
    ResultCode: number;
    ResultDesc: string;
    OriginatorConversationID: string;
    ConversationID: string;
    TransactionID?: string;
  };
};

export function parseB2CResult(payload: B2CResultPayload) {
  const r = payload?.Result;
  if (!r?.OriginatorConversationID) return null;
  return {
    originatorConversationId: r.OriginatorConversationID,
    conversationId: r.ConversationID,
    resultCode: Number(r.ResultCode),
    resultDesc: r.ResultDesc,
    transactionId: r.TransactionID,
  };
}

export function mockStkCallback(checkoutRequestId: string, amount: number, phone: string, success: boolean): StkCallbackPayload {
  return {
    Body: {
      stkCallback: {
        MerchantRequestID: "MOCK",
        CheckoutRequestID: checkoutRequestId,
        ResultCode: success ? 0 : 1032,
        ResultDesc: success ? "The service request is processed successfully." : "Request cancelled by user",
        CallbackMetadata: success
          ? {
              Item: [
                { Name: "Amount", Value: amount },
                { Name: "MpesaReceiptNumber", Value: `MOCK${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}` },
                { Name: "PhoneNumber", Value: Number(phone) },
              ],
            }
          : undefined,
      },
    },
  };
}

export function mockB2CResult(originatorConversationId: string, conversationId: string): B2CResultPayload {
  return {
    Result: {
      ResultType: 0,
      ResultCode: 0,
      ResultDesc: "The service request is processed successfully.",
      OriginatorConversationID: originatorConversationId,
      ConversationID: conversationId,
      TransactionID: `MOCKB2C${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
    },
  };
}
