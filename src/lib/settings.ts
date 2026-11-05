import "server-only";
import { db } from "./db";
import { config } from "./config";

export type PlatformSettings = {
  commissionPercent: number;
  dispatchWindowHours: number;
  autoReleaseDays: number;
};

const KEYS = {
  commissionPercent: "commission_percent",
  dispatchWindowHours: "dispatch_window_hours",
  autoReleaseDays: "auto_release_days",
} as const;

export async function getSettings(): Promise<PlatformSettings> {
  const rows = await db.setting.findMany({ where: { key: { in: Object.values(KEYS) } } });
  const map = new Map(rows.map((r) => [r.key, Number(r.value)]));
  return {
    commissionPercent: map.get(KEYS.commissionPercent) ?? config.escrow.defaultCommissionPercent,
    dispatchWindowHours: map.get(KEYS.dispatchWindowHours) ?? config.escrow.dispatchWindowHours,
    autoReleaseDays: map.get(KEYS.autoReleaseDays) ?? config.escrow.autoReleaseDays,
  };
}

export async function saveSettings(s: PlatformSettings) {
  await db.$transaction(
    (Object.keys(KEYS) as (keyof PlatformSettings)[]).map((k) =>
      db.setting.upsert({
        where: { key: KEYS[k] },
        create: { key: KEYS[k], value: String(s[k]) },
        update: { value: String(s[k]) },
      }),
    ),
  );
}
