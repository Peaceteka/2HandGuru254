import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

export async function audit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: Prisma.InputJsonValue,
  tx: Prisma.TransactionClient = db,
) {
  await tx.auditLog.create({ data: { actorId, action, entityType, entityId, details } });
}
