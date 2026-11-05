import "server-only";
import { db } from "./db";
import { fileUrl } from "./storage";

export async function loadListingForEdit(id: string) {
  const l = await db.listing.findUnique({ where: { id }, include: { images: { orderBy: { position: "asc" } } } });
  if (!l) return null;
  return { ...l, images: l.images.map((i) => ({ id: i.id, url: fileUrl(i.key) })) };
}
