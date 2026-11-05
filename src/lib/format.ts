import { format, formatDistanceToNowStrict } from "date-fns";

export function formatKES(amount: number) {
  return `KES ${Math.round(amount).toLocaleString("en-KE")}`;
}

export function formatDate(d: Date | string | null | undefined, withTime = false) {
  if (!d) return "—";
  return format(new Date(d), withTime ? "d MMM yyyy, HH:mm" : "d MMM yyyy");
}

export function timeAgo(d: Date | string) {
  return `${formatDistanceToNowStrict(new Date(d))} ago`;
}

export function maskPhone(phone: string) {
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 6)}***${phone.slice(-3)}`;
}

export function formatMonthYear(d: Date | string) {
  return new Date(d).toLocaleDateString("en-KE", { month: "short", year: "numeric", timeZone: "Africa/Nairobi" });
}
