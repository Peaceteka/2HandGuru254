import { z } from "zod";
import { KENYAN_COUNTIES } from "./constants";
import { normalizeKenyanPhone } from "./phone";

export const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizeKenyanPhone(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid Kenyan mobile number, e.g. 0712 345 678" });
      return z.NEVER;
    }
    return n;
  });

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const countySchema = z.enum(KENYAN_COUNTIES, { errorMap: () => ({ message: "Choose a county" }) });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(80),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    accountType: z.enum(["BUYER", "SELLER"]),
    acceptTerms: z.literal("on", { errorMap: () => ({ message: "You must accept the terms" }) }),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export const sellerApplicationSchema = z.object({
  fullName: z.string().trim().min(3, "Enter your full legal name").max(100),
  phone: phoneSchema,
  idNumber: z.string().trim().regex(/^\d{6,10}$/, "Enter a valid national ID number"),
  businessName: optionalText(100),
  county: countySchema,
  town: optionalText(60),
  description: z.string().trim().min(20, "Tell buyers a little more (20+ characters)").max(600),
});

export const forgotPasswordSchema = z.object({ identifier: z.string().trim().min(3).max(120) });

export const resetPasswordSchema = z
  .object({ token: z.string().min(20), password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1), password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  county: countySchema.optional().or(z.literal("").transform(() => undefined)),
});

export const sellerSettingsSchema = profileSchema.extend({
  mpesaPayoutPhone: phoneSchema,
  businessName: optionalText(100),
  description: z.string().trim().min(20).max(600),
});

export const listingSchema = z.object({
  title: z.string().trim().min(5, "Title is too short").max(100),
  description: z.string().trim().min(20, "Describe the item (20+ characters)").max(4000),
  categoryId: z.string().min(1, "Choose a category"),
  condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR", "FOR_PARTS"]),
  price: z.coerce.number({ invalid_type_error: "Enter a price" }).int("Whole shillings only").min(50, "Minimum price is KES 50").max(10_000_000),
  county: countySchema,
  town: optionalText(60),
  status: z.enum(["DRAFT", "ACTIVE", "HIDDEN", "SOLD"]),
  featured: z.literal("on").optional(),
});

export const checkoutSchema = z.object({
  listingId: z.string().min(1),
  buyerPhone: phoneSchema,
  deliveryCounty: countySchema,
  deliveryTown: z.string().trim().min(2, "Enter a town or area").max(60),
  deliveryAddress: z.string().trim().min(5, "Enter a delivery address or pickup point").max(200),
  deliveryNotes: optionalText(300),
});

export const dispatchSchema = z.object({
  courier: z.string().trim().min(2, "Enter the courier or delivery method").max(80),
  trackingNote: z.string().trim().max(300).optional().default(""),
});

export const disputeSchema = z.object({
  reason: z.enum(["NOT_RECEIVED", "NOT_AS_DESCRIBED", "DAMAGED", "COUNTERFEIT", "WRONG_ITEM", "OTHER"]),
  note: z.string().trim().min(20, "Explain what went wrong (20+ characters)").max(2000),
});

export const evidenceSchema = z.object({ note: z.string().trim().min(5).max(2000) });

export const reasonSchema = z.object({ reason: z.string().trim().min(5, "Give a short reason").max(500) });

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only").max(60),
  icon: z.string().trim().max(40).default("package"),
  description: optionalText(200),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const settingsSchema = z.object({
  commissionPercent: z.coerce.number().min(0).max(30),
  dispatchWindowHours: z.coerce.number().int().min(12).max(240),
  autoReleaseDays: z.coerce.number().int().min(1).max(30),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  message: z.string().trim().min(10).max(2000),
});

export type FieldErrors = Record<string, string[] | undefined>;
export type ActionResult = { ok?: boolean; error?: string; message?: string; fieldErrors?: FieldErrors };

export function fail(error: z.ZodError): ActionResult {
  return { error: "Please fix the highlighted fields.", fieldErrors: error.flatten().fieldErrors as FieldErrors };
}

export function formObject(fd: FormData) {
  const obj: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") obj[k] = v;
  return obj;
}
