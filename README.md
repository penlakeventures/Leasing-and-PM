# Pen Lake Ventures — Leasing & Property Management

Internal system for leasing and property management across Pen's 7 rental
projects (75 units). Scope is deliberately limited to the "consumer side" —
development/construction stays out, per `docs/phase0_data_model.md`.

## Phase 1 status

This is the Phase 1 foundation: a working full-stack app with the complete
data model, authentication, and CRUD for every entity — not just a schema.

- **Data model** — all 10 entities from `docs/phase0_data_model.md`
  (Project, Unit, Tenant, Lease, Security Deposit, Lead, Maintenance Ticket,
  Vendor, Communication Log, Compliance Record), plus two small lookup
  tables (`CpiRate`, `DepositInterestRate`) added so those annual rates are
  entered, not hardcoded — the data model doc calls this out explicitly for
  the deposit interest rate, and the same reasoning applies to CPI.
- **Auth** — simple email/password login for Ryan and Alina (both full
  access). The `role` field on `User` is a plain string, not an enum, so an
  outsourced PM company or other scoped role can be added later without a
  migration.
- **Compliance rules enforced in code** (see `src/lib/rules.ts`):
  - An affordable unit's rent can't be increased past the current year's
    Statistics Canada CPI rate (CMHC MLI Select requirement).
  - A security deposit can't exceed one month's rent, and can't be
    increased once set (Alberta RTA).
  - The dashboard flags any deposit past its 10-day return deadline.
  - A periodic lease's rent can be raised at most once every 365 days,
    and only with ≥3 months' written notice recorded before the increase
    takes effect (Alberta RTA). Doesn't apply to fixed-term leases, and
    doesn't model a "pending" future rent — see the comment on
    `checkRentIncreaseNotice` for the exact assumptions and a caveat
    about leases imported without prior rent-increase history.
- **Seed data** — the real 7-project, 75-unit portfolio from the company
  context doc (see `prisma/seed.ts` for exactly what's derived vs. sourced
  directly).

## Tech stack

Chosen in this session (the source docs left hosting flexible and asked
for a pick once scaffolded):

- **Next.js 16 (App Router) + TypeScript** — one codebase for UI and API,
  server actions instead of a separate REST layer.
- **PostgreSQL + Prisma** (pinned to Prisma **6.19.3** — the last version
  before 7.x's mandatory driver-adapter config change; keeps `DATABASE_URL`
  simple for Railway/Render).
- **Auth.js (next-auth) v5**, credentials provider, JWT sessions — no OAuth
  needed for two internal users.
- **Tailwind CSS** for styling.
- **Hosting**: Railway or Render, per the context doc — both give a managed
  Postgres + app deploy with no server admin. Set `DATABASE_URL`,
  `AUTH_SECRET`, `NEXTAUTH_URL` (your production URL), and `SEED_TOKEN`
  (any random string) as environment variables. `railway.json` in the repo
  root already tells Railway to run `npx prisma migrate deploy` before
  `npm run start` on every deploy, so pending migrations apply
  automatically — no dashboard config needed for that. Render doesn't read
  `railway.json`; set its start command to the same
  `npx prisma migrate deploy && npm run start` in its dashboard if you
  deploy there instead.

  Migrations create the empty tables, but nothing creates the two user
  accounts or loads the real portfolio until you visit, once, in a
  browser: `https://<your-deployed-url>/api/seed?token=<your SEED_TOKEN>`.
  That's the same seed data `npm run db:seed` loads locally — this is just
  a no-terminal-required way to trigger it in production (there's a
  chicken-and-egg problem otherwise: the app has no users yet, so nothing
  behind login can help create the first ones). It's safe to visit more
  than once — every write is an upsert, so re-running does nothing
  destructive. Prefer a terminal? `railway run npm run db:seed` does the
  same thing using Railway's CLI instead.

## Getting started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and AUTH_SECRET (npx auth secret)
npx prisma migrate dev # creates the schema
npm run db:seed        # optional — loads the real 7-project portfolio
npm run dev
```

Seeded login — **change these immediately**, before entering any real
tenant/lease data. Click your name (top right) → Change password:

- `ryan@penventures.ca` / `ChangeMe123!`
- `alina@penventures.ca` / `ChangeMe123!`

Before affordable-unit rent changes or deposit interest will compute
correctly, set the current year's rates under **Rates** in the nav
(Statistics Canada CPI, and the Alberta deposit interest rate — 2026 is
pre-seeded at 0% per the source doc).

## Real-portfolio import (one-time, already run in production)

`src/lib/rent-roll-data.ts` holds the real 75-unit portfolio — units,
tenants, leases (including each lease's last-month-rent-prepaid and
pets, both now real `Lease` fields, editable from the lease form like
anything else), and security deposits — generated from the 2026 rent
roll and tenant contact list the user provided, replacing the
placeholder numbers from the initial seed. `GET /api/import-rent-roll`
(behind normal login, unlike `/api/seed`) applies it; safe to re-run —
a project that already has a lease on file is never deleted/recreated,
just checked for any of the above fields still missing and backfilled
(e.g. this is how prepaid/pets reached production, which had already
run the import before those fields existed).

Known gaps from that import, worth fixing when the info is available:
- Only the first tenant listed on each lease got a phone number — the
  contact PDF has one number per unit, not per person.
- 4 security deposits had no date on file in the source and fell back to
  the lease start date instead.

`src/lib/cmhc-designations.ts` + `GET /api/import-cmhc-designations` set
each unit's real CMHC Market/Affordable designation — the user's
compliance-tracking spreadsheet covered 59 of the 75 units; the other
16 (Killarney23 and Glenbrook30, both entire projects) aren't in that
spreadsheet, but the user separately confirmed neither project ever
carried a CMHC affordability requirement, so all their units are
market rate too — all 75 units now have a confirmed designation. Pure
metadata update (doesn't touch tenants/leases/rent), so always safe to
re-run.

## What's *not* in Phase 1

Carried forward from the open items in `docs/phase0_data_model.md`:

- **Gmail API integration** for lead intake — not wired up yet. Communication
  logs are entered manually for now.
- **SingleKey** tenant screening — deferred to Phase 2 per the source docs.
- **RentFaster / Facebook Marketplace** intake automation — leads are
  entered manually; the doc flags that Facebook Marketplace has no reliable
  message API, so this needs scoping before automating.
- Trust sub-account setup for deposits is a banking/accounting task, not a
  code task — the `trustAccountRef` field is ready to hold that reference
  once it exists.

## Project structure

```
prisma/schema.prisma       Data model
prisma/seed.ts              Real-portfolio seed data
src/lib/rules.ts            Compliance rules (CPI cap, deposit cap, 10-day return)
src/lib/actions/*.ts        Server actions (create/update/delete) per entity
src/app/(app)/*             Authenticated pages (dashboard + one folder per entity)
src/app/login               Login page
src/components/*            Shared UI + per-entity forms
```

## A known non-issue in `npm audit`

`npm audit` reports vulnerabilities in `mysql2` / `deepmerge-ts` — these are
transitive dependencies of Prisma's CLI tooling for *other* database
drivers, not used at runtime by this app (Postgres-only, via
`@prisma/client`). Safe to leave; re-check on your next `prisma` upgrade.
