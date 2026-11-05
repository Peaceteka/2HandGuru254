import "server-only";

function bool(v: string | undefined, fallback = false) {
  if (v === undefined || v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

export const config = {
  appUrl: (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, ""),
  appName: "2ndHandGuru",
  cronSecret: process.env.CRON_SECRET || "",
  escrow: {
    defaultCommissionPercent: Number(process.env.PLATFORM_COMMISSION_PERCENT ?? 5),
    dispatchWindowHours: Number(process.env.DISPATCH_WINDOW_HOURS ?? 72),
    autoReleaseDays: Number(process.env.AUTO_RELEASE_DAYS ?? 5),
    pendingPaymentTimeoutMinutes: Number(process.env.PENDING_PAYMENT_TIMEOUT_MINUTES ?? 30),
  },
  mpesa: {
    mode: (process.env.MPESA_MODE || "mock") as "mock" | "sandbox" | "production",
    consumerKey: process.env.MPESA_CONSUMER_KEY || "",
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || "",
    shortcode: process.env.MPESA_SHORTCODE || "174379",
    passkey: process.env.MPESA_PASSKEY || "",
    transactionType: process.env.MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline",
    b2cShortcode: process.env.MPESA_B2C_SHORTCODE || "600000",
    initiatorName: process.env.MPESA_INITIATOR_NAME || "testapi",
    securityCredential: process.env.MPESA_SECURITY_CREDENTIAL || "",
    callbackBaseUrl: (process.env.MPESA_CALLBACK_BASE_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
    callbackSecret: process.env.MPESA_CALLBACK_SECRET || "",
  },
  email: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    secure: bool(process.env.SMTP_SECURE),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASSWORD || "",
    from: process.env.EMAIL_FROM || "2ndHandGuru <no-reply@2ndhandguru.co.ke>",
  },
  sms: {
    provider: (process.env.SMS_PROVIDER || "console") as "console" | "africastalking",
    atUsername: process.env.AT_USERNAME || "sandbox",
    atApiKey: process.env.AT_API_KEY || "",
    atSenderId: process.env.AT_SENDER_ID || "",
  },
  storage: {
    driver: (process.env.STORAGE_DRIVER || "local") as "local" | "s3",
    localDir: process.env.STORAGE_LOCAL_DIR || "./uploads",
    s3Bucket: process.env.S3_BUCKET || "",
    s3Region: process.env.S3_REGION || "auto",
    s3Endpoint: process.env.S3_ENDPOINT || undefined,
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    s3ForcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE, true),
    s3PublicBaseUrl: (process.env.S3_PUBLIC_BASE_URL || "").replace(/\/$/, ""),
  },
};
