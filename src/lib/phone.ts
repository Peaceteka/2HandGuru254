/** Normalises Kenyan mobile numbers to the 2547XXXXXXXX / 2541XXXXXXXX format Daraja expects. */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "").replace(/^\+/, "");
  let local: string | null = null;
  if (/^254[71]\d{8}$/.test(digits)) local = digits.slice(3);
  else if (/^0[71]\d{8}$/.test(digits)) local = digits.slice(1);
  else if (/^[71]\d{8}$/.test(digits)) local = digits;
  return local ? `254${local}` : null;
}

export function displayPhone(normalized: string) {
  return normalized.startsWith("254") ? `0${normalized.slice(3)}` : normalized;
}
