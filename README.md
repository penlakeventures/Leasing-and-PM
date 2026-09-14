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
  `AUTH_SECRET`, and `NEXTAUTH_URL` (your production URL) as environment
  variables; run `npx prisma migrate deploy` as (or before) the start
  command, then `npm run db:seed` once if you want the real-portfolio seed
  data in production too.

## Getting started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and AUTH_SECRET (npx auth secret)
npx prisma migrate dev # creates the schema
npm run db:seed        # optional — loads the real 7-project portfolio
npm run dev
```

Seeded login (change immediately — see `prisma/seed.ts`):

- `ryan@penventures.ca` / `ChangeMe123!`
- `alina@penventures.ca` / `ChangeMe123!`

Before affordable-unit rent changes or deposit interest will compute
correctly, set the current year's rates under **Rates** in the nav
(Statistics Canada CPI, and the Alberta deposit interest rate — 2026 is
pre-seeded at 0% per the source doc).

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
