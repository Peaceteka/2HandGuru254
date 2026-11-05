# 2ndHandGuru

A second-hand marketplace for Kenya with **verified sellers** and **escrow-protected M-Pesa payments**.

Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn/ui (Radix) · PostgreSQL · Prisma · NextAuth (credentials) · M-Pesa Daraja (STK Push + B2C) · local/S3 storage.

## Quick start (local)

```bash
cp .env.example .env              # defaults work for local dev (MPESA_MODE=mock)
docker compose up -d db           # or point DATABASE_URL at your own Postgres 14+
npm install                       # runs prisma generate
npx prisma migrate deploy
npm run db:seed                   # wipes and seeds demo data
npm run dev                       # http://localhost:3000
```

### Full stack in Docker

```bash
cp .env.example .env              # set NEXTAUTH_SECRET, CRON_SECRET, MPESA_* etc.
docker compose up -d --build      # db + app (runs migrations on start) + scheduler
docker compose --profile tools run --rm seed   # optional demo data
```

### Demo accounts (after seeding)

| Role | Login | Password |
|---|---|---|
| Admin | admin@2ndhandguru.co.ke | Admin@12345 |
| Approved sellers | brian@example.com, wanjiku@example.com, hassan@example.com | Password123 |
| Pending seller | peter@example.com | Password123 |
| Buyers | amina@example.com (Daraja test MSISDN 254708374149), kevin@example.com | Password123 |

You can log in with email **or** phone (e.g. `0711000001`). The seed creates 8 categories, 25 listings, a platform-seller account (“2ndHandGuru Official”) for admin-owned listings, and orders in every escrow state (including one PAID_HELD order past its dispatch deadline and one DISPATCHED order past auto-release).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run db:seed` | Reset + seed demo data (refuses when `NODE_ENV=production` unless `SEED_FORCE=1`) |
| `npm run escrow:run` | Run the escrow scheduler once (auto-release, expire unpaid orders, resend payouts) |

## Environment variables

See [`.env.example`](.env.example) for the full annotated list. Key ones:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_URL`, `NEXTAUTH_URL` | Public base URL |
| `NEXTAUTH_SECRET` | Session signing secret (`openssl rand -base64 32`) |
| `PLATFORM_COMMISSION_PERCENT` | Default 5. Overridable in **Admin → Settings**; locked per order at creation |
| `DISPATCH_WINDOW_HOURS` / `AUTO_RELEASE_DAYS` | Default 72 h / 5 days |
| `PENDING_PAYMENT_TIMEOUT_MINUTES` | Unpaid orders are cancelled after this |
| `CRON_SECRET` | Bearer token for `POST /api/cron/escrow` |
| `MPESA_MODE` | `mock` \| `sandbox` \| `production` |
| `MPESA_*` | Daraja credentials, shortcodes, passkey, initiator, security credential |
| `MPESA_CALLBACK_BASE_URL`, `MPESA_CALLBACK_SECRET` | Public callback host and `?token=` secret |
| `STORAGE_DRIVER` | `local` (./uploads) or `s3` (any S3-compatible: AWS, R2, MinIO, Spaces) |
| `SMTP_*`, `EMAIL_FROM` | Email (logged to console when `SMTP_HOST` empty) |
| `SMS_PROVIDER`, `AT_*` | `console` or `africastalking` |

## M-Pesa Daraja sandbox

1. Create an app at <https://developer.safaricom.co.ke> with **M-Pesa Express (STK Push)** and **B2C** products. Copy the consumer key/secret.
2. In `.env`:
   ```dotenv
   MPESA_MODE="sandbox"
   MPESA_CONSUMER_KEY="..."
   MPESA_CONSUMER_SECRET="..."
   MPESA_SHORTCODE="174379"
   MPESA_PASSKEY="<Lipa Na M-Pesa Online passkey from the portal test credentials>"
   MPESA_B2C_SHORTCODE="<B2C test shortcode, e.g. 600xxx>"
   MPESA_INITIATOR_NAME="testapi"
   MPESA_SECURITY_CREDENTIAL="<generated in the portal from the initiator password>"
   MPESA_CALLBACK_SECRET="<random string>"
   ```
3. Daraja must reach your callbacks over HTTPS. In dev, expose port 3000 (e.g. `cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`) and set `MPESA_CALLBACK_BASE_URL` to the tunnel URL. The app registers these per request:
   - `POST /api/payments/stk/callback` — STK result
   - `POST /api/payments/b2c/result` — B2C result
   - `POST /api/payments/b2c/timeout` — B2C queue timeout
4. Use the sandbox test MSISDN `254708374149` as the buyer phone. If callbacks can't reach you, the order page has **“I've paid — check status”** which runs an STK Query.
5. `MPESA_MODE=mock` makes no network calls; the order page shows **Simulate successful/failed payment** buttons and B2C payouts complete instantly.

All raw callbacks are stored in `MpesaCallbackLog` before processing. Callbacks are idempotent: a payment/payout is only claimed while `PENDING`, and ledger postings use unique idempotency keys, so Daraja retries are harmless.

## Escrow flow

```
                 STK callback OK                  seller marks dispatched         buyer confirms
PENDING_PAYMENT ───────────────▶ PAID_HELD ───────────────────────▶ DISPATCHED ─────────────────▶ DELIVERED_CONFIRMED ──▶ RELEASED
      │                            │  │                                 │  │                                              ▲
      │ timeout / buyer cancels    │  │ seller misses 72h → buyer       │  │ no action 5 days after dispatch (scheduler)  │
      ▼                            │  │ cancels → refund                │  └──────────────────────────────────────────────┤
  CANCELLED ◀──────────────────────┘  ▼                                 │ buyer raises dispute (funds frozen)            │
                                   REFUNDED ◀── admin refund ──── DISPUTED ── admin resolves: release ─────────────────────┘
                                      ▲                               │
                                      └──────── admin resolves: refund┘
```

Admins can also manually release (PAID_HELD/DISPATCHED/DELIVERED_CONFIRMED) or refund (PAID_HELD/DISPATCHED) from **Admin → Orders**.

### Ledger (double-entry)

Every money movement is a balanced `LedgerTransaction` (sum of debits = sum of credits), shown per order in admin and as a trial balance on the admin dashboard.

| Event | Debit | Credit |
|---|---|---|
| Payment held | `MPESA_CLEARING` amount | `ESCROW_HELD` amount |
| Release | `ESCROW_HELD` amount | `SELLER_PAYABLE` net + `PLATFORM_FEE` commission |
| Refund | `ESCROW_HELD` amount | `REFUNDS_PAYABLE` amount |
| B2C payout success | `SELLER_PAYABLE` net | `MPESA_CLEARING` net |
| B2C refund success | `REFUNDS_PAYABLE` amount | `MPESA_CLEARING` amount |

`ESCROW_HELD` is always the funds currently held; `SELLER_PAYABLE`/`REFUNDS_PAYABLE` are B2C sends still in flight or failed (retry from the order page).

### Scheduler

`POST /api/cron/escrow` with `Authorization: Bearer $CRON_SECRET` (or `npm run escrow:run`) every ~5 minutes. docker-compose includes a `scheduler` service that does this. It auto-releases dispatched orders past `autoReleaseAt`, cancels stale unpaid orders, and resends pending payouts.

## Security notes

- Role guards: middleware gates `/account`, `/seller`, `/admin`, `/checkout`, `/sell/*`; every page, server action and API re-checks the role and seller approval against the database.
- zod validation on every server action; Kenyan phone normalisation to `2547XXXXXXXX`.
- Postgres-backed rate limiting on login, register, password reset, payment initiation, STK query, disputes and callbacks.
- Uploads are size/type-checked by magic bytes. ID photos and dispute evidence are private and served only to the owner, the counterparty (disputes) or admins.
- All admin actions are written to `AuditLog`.

## Project layout

```
prisma/            schema, migrations, seed
src/app/(site)/    public storefront, auth, account (buyer), seller, admin
src/app/api/       NextAuth, Daraja callbacks, cron, file serving, health
src/lib/           escrow state machine, ledger, mpesa, storage, notifications, auth, validators
src/server/        server actions
```

## Out of scope for v1

Live delivery tracking, in-app chat, reviews/ratings and native apps are not built. The schema leaves room for them (e.g. `Order.courier/trackingNote`, `OrderEvent` timeline, notification types).
