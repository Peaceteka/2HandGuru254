import { NextResponse, type NextRequest } from "next/server";
import { storage } from "@/lib/storage";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
};

async function canReadPrivate(key: string) {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  const [, kind, owner] = key.split("/");
  if (kind === "ids") return owner === user.id;
  if (kind === "disputes") {
    const order = await db.order.findUnique({ where: { id: owner }, select: { buyerId: true, sellerId: true } });
    return !!order && (order.buyerId === user.id || order.sellerId === user.id);
  }
  return false;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params;
  const key = parts.map(decodeURIComponent).join("/");
  const isPrivate = key.startsWith("private/");
  if (isPrivate && !(await canReadPrivate(key))) return new NextResponse("Not found", { status: 404 });
  const file = await storage().get(key);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": file.contentType,
      "Cache-Control": isPrivate ? "private, no-store" : "public, max-age=31536000, immutable",
    },
  });
}
