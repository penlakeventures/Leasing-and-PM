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

## RentFaster lead capture (live in production)

`POST /api/leads/rentfaster-inbound?token=<RENTFASTER_INBOUND_TOKEN>` turns
a RentFaster lead-inquiry email into a `Lead` record — contact info,
requested move-in date, and the listing details/comments kept on
`Lead.message` (only auto-links to a specific `Unit` when bedroom count +
neighbourhood narrow it to exactly one candidate; otherwise left for staff
to link by hand). Also logs an inbound `CommunicationLog` entry. Accepts
either a JSON or form-encoded body (`subject`, `text`, `replyTo`/`Reply-To`
— not tied to a specific email-forwarding provider's exact field names).
Idempotent, keyed on RentFaster's own per-lead reply-to token — safe to
receive the same email more than once.

Parsing lives in `src/lib/rentfaster-lead-parse.ts`. Pipeline: RentFaster's
emails land at `leasing@penventures.ca` (Google Workspace) → a Gmail filter
forwards a *copy* (inbox untouched — no "skip the inbox") to a Postmark
inbound stream → Postmark's webhook POSTs to the URL above. Live and
verified end-to-end in production as of this write-up.

## Facebook Marketplace lead capture (webhook built, currently unreachable — see below)

`POST /api/leads/facebook-messenger-webhook` turns Messenger messages on
the business's Facebook Page into `Lead` records — one lead per sender
(keyed on their page-scoped ID), with each new message appended to that
lead's `message` field as a running conversation rather than creating a
new lead every time. Also logs an inbound `CommunicationLog` entry per
message (channel `MESSENGER`), deduped by Messenger's own message ID so a
webhook retry doesn't log the same message twice. `GET` on the same URL
handles Meta's one-time verification handshake. Every `POST` is checked
against Meta's `X-Hub-Signature-256` header (HMAC using `FACEBOOK_APP_SECRET`)
before anything is processed. Logic lives in
`src/lib/facebook-messenger-webhook.ts`; tested against realistic Meta
payloads (valid/invalid signature, a new lead, a follow-up message
appending to the same lead, a redelivered message being a no-op, and a
non-message event like a delivery receipt being ignored without error).

Contact name is a best-effort Graph API lookup (`FACEBOOK_PAGE_ACCESS_TOKEN`)
— Messenger's webhook payload never includes it directly, and Meta doesn't
guarantee the lookup succeeds even with the token, so a lead with no name
attached is expected, not a bug.

**Blocked, not just pending**: this isn't a review-time problem — Meta's
Messenger Platform API fundamentally cannot access a personal profile's
inbox for any third-party app, under any permission, and Facebook doesn't
allow a business Page to post to Marketplace's housing/rental category
(confirmed directly against Facebook, not assumed). Since Marketplace
messages land in a personal profile's Messenger, there's currently no
legitimate way to automate this specific channel — anything that could
(browser automation, scripting the personal account) would risk that
account getting flagged or banned, which is off the table by design.

Decision (for now): leave Facebook Marketplace leads fully manual, same
as before this webhook existed. The code above stays in place — it's
ready to turn on if either constraint changes (a syndication partner with
an official Marketplace distribution + its own lead-notification emails,
which would need no Meta review at all; or a shift in Facebook's own
rules).

## What's *not* in Phase 1

Carried forward from the open items in `docs/phase0_data_model.md`:

- **SingleKey** tenant screening — deferred to Phase 2 per the source docs.
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
