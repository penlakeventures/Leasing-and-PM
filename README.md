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

## Google Calendar tour scheduling

Tour scheduling on a Lead's detail page creates a real event on a
connected Google Calendar (Settings → Calendar → Connect Google
Calendar — a one-time OAuth flow; the resulting refresh token is stored
in the database, not an environment variable, so reconnecting from a
different account or after a revoke never needs a redeploy). Only one
connection is active at a time.

Booking a tour invites the assigned staff member and the lead (if their
email is on file) as attendees — this is how a specific staff member's
own calendar shows the tour without the app needing a separate
connection per person: Google Calendar does that automatically once
they're an attendee. The event's summary/description/location are built
from the lead's own info (unit, contact details, notes); duration is a
fixed 30 minutes. `Lead.tourEventId` is Google's own event ID, kept so
cancelling finds and removes the exact event rather than guessing.

Timezone handling: this business operates in exactly one timezone
(Mountain Time, `America/Edmonton`), so the tour form's plain
date/time picker is always interpreted as Mountain local time —
converted to a true UTC instant for storage using the built-in `Intl`
API (handles the MST/MDT daylight-saving switch correctly without a
timezone library), verified against both a summer and winter date.

**Setup required**: a Google Cloud project with the Calendar API
enabled, and an OAuth 2.0 Client ID (type "Web application") with
`https://<your-app>/api/calendar/callback` as an authorized redirect
URI — `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` from that go in the
environment (see `.env.example`), then connect an account from
Settings → Calendar.

## Dropbox lease-document filing

New leases automatically get a Dropbox folder instead of someone
creating one by hand and pasting a link in — Settings → Documents →
Connect Dropbox (same one-time OAuth pattern as Google Calendar; the
refresh token is stored in the database, not an environment variable).
Settings → Documents also holds the base folder path — the Dropbox
folder containing the numbered per-project folders (e.g.
`/1. Pen Ventures Inc./0.0 LEASING OPERATIONS`), each of which must be
named `"{displayOrder}. {internalName}"` (e.g. `1. Killarney23`,
`2. Glenbrook30`) to match how the owner's Dropbox is actually
organized. Unit folders inside a project folder are named by hand as
`"{unit number}"`, optionally followed by a space or hyphen and the
tenant's name(s) — e.g. `3220B Taylor`, `3218B - Kelsey Williamson` —
so a unit's current folder is found by matching that prefix, not an
exact path.

On `createLease`, `prepareLeaseFolder()` in `src/lib/dropbox.ts`: lists
the project folder and looks for a folder matching the unit number (a
new `Lease` row only gets created on real turnover — renewals of an
existing tenant reuse the same lease and just get a subfolder added by
hand). Exactly one match gets moved into that project's `Past tenants`
folder (auto-renamed if that unit's already been archived there
before); zero matches means nothing to archive; more than one match is
treated as ambiguous and skipped rather than guessing, logged for a
human to sort out. Either way, a fresh folder named
`"{unit number} {tenant name(s)}"` is created for the new tenancy and a
shared link to it is saved as the lease's Document link. This mirrors
how the owner already organized Dropbox by hand — a project folder's
top level stays a clean list of currently-active units, with departed
tenants' full folders parked under `Past tenants`.

Never blocks lease creation: if Dropbox isn't connected, the base path
isn't set, or the API call fails for any reason, the lease still saves
(the error is logged) and staff can fill in Document link by hand, same
as before this existed.

**Uploading a document straight to that folder.** `prepareLeaseFolder()`
now returns the actual Dropbox path behind the shared link, saved as
`Lease.documentsFolderPath` — so the Lease page's Documents panel can
offer a real upload button (`uploadLeaseDocument()` in
`src/lib/actions/leases.ts`, using `uploadFile()` in `src/lib/dropbox.ts`
— the one place this app writes file *content* to Dropbox rather than
just managing folders/links) instead of staff always having to open
Dropbox itself. Built for filing a SingleKey report once an applicant's
approved and has a signed lease (see "Tenant screening" below), but
works for any document. Only offered when `documentsFolderPath` is on
file — a lease from before this existed, or one where staff pasted a
link in by hand instead of it being auto-created, has no known upload
target, so the panel just shows the folder link and staff drag files in
via Dropbox directly, same as always.

**Setup required**: a Dropbox App Console app (dropbox.com/developers/apps)
with "Scoped access" and "Full Dropbox" access, and a redirect URI of
`https://<your-app>/api/dropbox/callback` — `DROPBOX_APP_KEY`/
`DROPBOX_APP_SECRET` from that go in the environment (see
`.env.example`), then connect an account and set the base folder path
from Settings → Documents.

## SMS (Twilio)

A dedicated phone number for texting with leads and tenants — kept
deliberately separate from any personal phone. Inbound texts land on
`/api/sms/twilio-webhook` (public, guarded by Twilio's own
request-signature check per `verifyTwilioSignature()` in
`src/lib/twilio.ts`, same shape as the Facebook Messenger webhook's
signature check) and are matched to whoever owns that phone number: a
`Tenant` match takes priority over a `Lead` match (an existing tenant
texting in is the common case), and an unrecognized number becomes a
new `Lead` (source `OTHER`) the same append-to-existing-thread way the
Messenger webhook handles an unknown sender — a second text from a
still-unmatched number appends to that lead rather than creating a
new one. Phone numbers are stored as whatever free text staff typed in,
so matching compares the last 10 digits (`normalizePhone()` in
`src/lib/phone.ts`) rather than requiring one canonical format.

Every text — inbound or outbound — is a `CommunicationLog` row
(`channel: TEXT`), shown as a conversation thread (`MessagePanel`) on
the matching tenant's or lead's own page, with a reply box right there;
sending goes through `sendTenantText`/`sendLeadText` in
`src/lib/actions/sms.ts`, which call Twilio's REST API directly (no
SDK, matching the Google Calendar/Dropbox pattern) and log the
outbound message the same way.

**Setup required**: a Twilio account and a purchased phone number
(console.twilio.com) — `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/
`TWILIO_PHONE_NUMBER` go in the environment (see `.env.example`).
Unlike Calendar/Dropbox there's no in-app "connect" step: instead, set
that phone number's "A message comes in" webhook, in the Twilio
Console, to the URL shown on Settings → Texting once deployed.

## Orchestrator inbox

`/inbox` — the actual "orchestrator agent" from the project's original
design: every inbound text (tenant, lead, or vendor) lands here as a row
needing attention, newest first, until someone replies or dismisses it.
Two pieces:

- **Routing.** Right after an inbound text is logged (the Twilio
  webhook), `triageInboundMessage()` in `src/lib/orchestrator.ts` decides
  what it needs and has the matching specialist draft it, so it's already
  waiting when someone opens the Inbox instead of a human having to
  notice the text and pick the right button themselves:
  - A **tenant** text is classified first (`classifyTenantMessage()` in
    `src/lib/claude.ts` — one cheap call, MAINTENANCE or QUESTION) so
    exactly one draft gets generated, not both for every text: a
    maintenance ticket draft, or a Q&A reply draft. A maintenance-shaped
    text with no active lease/unit on file still gets a Q&A-style draft
    instead — a ticket needs a unit, a reply doesn't.
  - A **lead** text (existing or brand new, from an unrecognized number)
    always gets a reply draft — same `draftSmsReply()` as before, just
    now triggered automatically instead of only on a button click.
  - A **vendor** text gets no AI draft — usually a status update ("done",
    "tomorrow"), not something worth drafting a reply to. Just flagged.
  - Never sends or creates anything, and a classification/drafting
    failure here (e.g. no API key) is swallowed, not thrown — the
    inbound text is already safely logged either way, and staff can
    still draft manually from the tenant/lead page as before.
- **Tracking.** `attentionClearedAt` on Tenant/Lead/Vendor marks when a
  contact's latest inbound text was last handled; `threadNeedsAttention()`
  in `src/lib/rules.ts` derives "needs a reply" from that plus the
  contact's most recent `CommunicationLog` row — no separate "unread"
  state to fall out of sync. Sending a real reply (any of the existing
  `sendTenantText`/`sendLeadText`/`sendVendorText` actions) or creating a
  ticket from a draft clears it automatically; a text that doesn't need a
  reply (a "thanks", a vendor confirming a job's done) can be cleared by
  hand with the Inbox row's **Dismiss** button. The Dashboard's "Needs a
  reply" count is the same query, so the two pages can't disagree.

No new setup required — reuses the Twilio and Anthropic credentials
already configured above.

## AI-drafted lead replies

A "✨ Suggest a reply" button on a Lead's Texts panel (`MessagePanel` —
also wired up on the Tenant page, see "Tenant Q&A" below) that calls Claude
(`draftSmsReply()` in `src/lib/claude.ts`, via the official
`@anthropic-ai/sdk` — the one exception to this project's usual
raw-`fetch` pattern for third-party APIs, since an official SDK exists
here) to draft a short SMS reply from the lead's info (unit interest,
notes, status) and its text conversation so far, and saves it to
`Lead.draftReply`.

**Deliberately never sends anything itself.** The draft just pre-fills
the reply box for a staff member to review, edit, or discard before
clicking Send (the existing `sendLeadText` action) — matching the
project's own stated design that anything touching a prospective
tenant, and certainly anything that could deny or condition someone's
housing, goes through a person first. This button is the manual
(re)run; the Orchestrator inbox above already runs the same drafting
automatically right after an inbound text comes in, so most of the
time a draft is already waiting — the button's still here for staff to
regenerate it (e.g. after editing the lead's unit/status) or if the
automatic one failed. The system prompt hard-codes Alberta Human
Rights Act guardrails (never ask about protected characteristics,
never imply an approval/rejection outcome, never invent unit details).
The draft is cleared automatically once a real reply goes out for that
lead, so a stale suggestion can't linger.

**Setup required**: an Anthropic API key (console.anthropic.com) —
`ANTHROPIC_API_KEY` goes in the environment (see `.env.example`).
No separate in-app connection step.

## Maintenance ticket → vendor dispatch

Extends the texting/AI-drafting pattern above to Phase 3 (management
agents): tenant maintenance requests become tickets, and vendors get
texted the details directly.

- **Vendors now text two-way, same as tenants and leads.** `Vendor` got
  its own `CommunicationLog` relation and its own `MessagePanel` on the
  vendor detail page; `findContactByPhone()` in `src/lib/sms-inbound.ts`
  checks Tenant, then Lead, then Vendor before falling back to
  creating a new lead for a genuinely unrecognized number.
- **AI-drafted tickets from a tenant's texts.** A "✨ Draft a ticket from
  recent texts" button on the Tenant page (`TicketDraftPanel`) calls
  `draftMaintenanceTicket()` in `src/lib/claude.ts`, which reads the
  tenant's recent texts and drafts a description plus a suggested
  priority (LOW/MEDIUM/HIGH/URGENT, per a stated severity guide) — saved
  to `Tenant.draftTicketDescription`/`draftTicketPriority` for a human
  to review, edit, and turn into a real `MaintenanceTicket` (unit comes
  from the tenant's own active lease, via `pickActiveLease()`, not from
  the draft — it can't drift from who the ticket is actually for).
  Never creates a ticket itself. The Orchestrator inbox above already
  runs this automatically for a maintenance-classified tenant text; this
  button is the manual (re)run.
- **"Notify vendor" on a ticket** (`notifyVendor()` in
  `src/lib/actions/tickets.ts`) texts the assigned vendor the unit
  address, priority, description, and tenant contact info so they can
  arrange access directly — the same information a dispatcher would
  give over the phone. A deliberate, staff-triggered action (not
  automatic on assignment or on every edit), and `vendorNotifiedAt` on
  the ticket shows whether/when it actually went out.

No new setup required — reuses the Twilio and Anthropic credentials
already configured above.

## Tenant Q&A

The same "✨ Suggest a reply" AI-drafting pattern as Lead replies above,
now also on the Tenant page's Texts panel (`MessagePanel`), for a
tenant's general questions — rent amount/due date, lease dates, unit
details, straightforward policy questions — as opposed to a maintenance
issue, which uses the separate "Draft a ticket" button instead.
`draftTenantReply()` in `src/lib/claude.ts` reads the tenant's active
lease (via `pickActiveLease()`) and recent texts, and saves its draft to
`Tenant.draftReply` — same review-before-send discipline as everything
else here: never sends anything itself, and the system prompt hard-codes
it to punt to a human for anything legal, anything that would change the
lease/rent/deposit, anything about another tenant, or anything that
reads like a safety emergency (told to call, not text). Cleared
automatically once a real reply goes out, same as a lead's draft. The
Orchestrator inbox above already runs this automatically for a
question-classified tenant text; this button is the manual (re)run.

No new setup required — reuses the Anthropic credentials already
configured above.

## Rent tracking & reminders

`/rent` — a monthly rent ledger, one row per lease per calendar month
(`RentPayment`), with a running unpaid/overdue count on the page and on
the Dashboard, and a one-click Mark paid / Undo per row.

Unlike the AI-drafted features above, a rent reminder is a fixed,
factual statement ("rent of $X is due on the 1st") rather than an
open-ended judgment call, so it sends itself — no draft-and-approve
step. Two pieces, both in `src/lib/rent-reminders.ts`:

- `ensureCurrentPeriodPayments()` creates this month's charge
  (`amountDue` snapshotted from the lease's current rent) for every
  currently-active lease that doesn't already have one for this period
  — idempotent, called both by the daily cron below and by the `/rent`
  page itself on every load, so the ledger is never empty waiting on
  the cron to run.
- `sendRentReminders()` texts every tenant with a phone on file, once,
  on the due date itself (`isRentReminderDue()` in `src/lib/rules.ts`,
  called with `daysBefore: 0` — most tenants pay on time, so the owner
  chose to skip an early heads-up) — logged to `CommunicationLog` like
  any other text. `RentPayment.reminderSentAt` guarantees exactly one reminder
  per period, even if the cron runs more than once in a day; a lease
  with no tenant phone on file is skipped (not marked reminded), so
  it's picked up automatically once a phone is added rather than
  silently given up on.

**Rent is assumed due on the 1st of every month** — there's no
per-lease due-day field today, so every lease is treated the same way;
worth knowing if any of your leases actually have a different due date
on paper.

**Setup required**: this app has no built-in scheduler, so a GitHub
Actions workflow (`.github/workflows/rent-reminders.yml`) calls the
token-guarded `/api/cron/rent-reminders` endpoint once a day. Needs
`CRON_TOKEN` set in the environment (see `.env.example`) and, as GitHub
repo secrets (Settings → Secrets and variables → Actions),
`APP_BASE_URL` (your deployed app's URL) and `CRON_TOKEN` (the same
value). The workflow can also be triggered manually from the Actions
tab for testing.

## Tenant screening

`TenantScreening` (one per `Lead`) records the outcome of a SingleKey (or
similar) report, not the report itself — SingleKey is a web portal with no
API/webhook access on this account, confirmed directly, so there's nothing
here to integrate against. Staff request the report on SingleKey's own
site as before; this just keeps the report link, a copied-over
summary/score, and — separately — the actual human decision (Pending/
Approved/Declined, with notes) on file with the rest of that lead's
record, shown on the Lead detail page and as a status badge on the Leads
list.

Deliberately never derives the decision from the report automatically:
that call is always a person's, consistent with how every other
compliance-adjacent piece of this app works (rent caps, deposit rules,
the forced password change) — flag/organize, never auto-decide something
that could deny someone housing. `decidedBy`/`decidedAt` are only stamped
on an actual change of decision (re-saving the same one, e.g. to edit a
note, doesn't re-stamp it), and clear automatically if the decision is
ever reset back to Pending. A lead with a screening record on file can't
be deleted until that's resolved first, same pattern as leases with a
security deposit.

This is the entire "application" step for this business — SingleKey's
report already covers the application, credit check, and background
check together, so there's no separate intake form for this app to
collect. What this app adds on top: the human review gate above (the
decision, and only a person makes it), and once someone's approved and
has a signed lease, filing the SingleKey report itself into that lease's
Dropbox folder — see "Uploading a document straight to that folder"
under Dropbox lease-document filing above.

## What's *not* in Phase 1

Carried forward from the open items in `docs/phase0_data_model.md`:

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
