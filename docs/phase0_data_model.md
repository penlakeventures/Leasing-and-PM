# Pen Lake Ventures — leasing & PM system data model (Phase 0 draft)

Scope: leasing and property management only (the "consumer side" — Alina's world).
Development/construction (Ryan's SOP, permits, project financials) stays out of this system.

## Core entities

### 1. Project entity
The 7 single-purpose corporations, each the legal owner of one property.
- `id`
- `internal_name` (e.g. "Killarney23") — matches the financial statements
- `website_code` (e.g. "KLY2337") — matches penventures.ca
- `neighbourhood`
- `address`
- `occupancy_date`
- `cmhc_loan_ref` (optional, for later linking to renewal-ladder tracking)

### 2. Unit
- `id`
- `project_entity_id` (FK)
- `unit_type`: town | suite | barn
- `bedrooms`, `sqft`
- `cmhc_designation`: market | affordable
- `base_rent`, `current_rent`
- `tenancy_type`: external | internal (the barn is `internal` — flags it as a Pen-to-Pen
  payment for financial reporting clarity, while it still appears in the rent roll as requested)

### 3. Tenant
- `id`
- `name`, `contact info` (phone, email)
- `emergency_contact` (optional)

### 4. Lease
- `id`
- `unit_id` (FK)
- `tenant_id(s)` — support more than one tenant per lease (couples/roommates)
- `start_date`, `end_date` or `periodic` flag
- `rent_amount`
- `rent_escalation_rule`: for `affordable` units, capped at annual CPI (Statistics Canada) —
  the system should refuse or flag any rent change on an affordable unit that exceeds this
- `signed_date`, `document_link`

### 5. Security deposit
- `id`
- `lease_id` (FK)
- `amount` (capped at one month's rent per Alberta RTA, cannot increase later)
- `date_received`
- `trust_account_ref` — points at the dedicated trust sub-account (see flag above)
- `interest_rate_year` / `interest_accrued` (annual rate set by AB regulation — 0% for 2026,
  but the field must be re-set each year, not hardcoded)
- `date_returned`, `deductions` (itemized, 10-day return deadline enforced by the system)

### 6. Lead
- `id`
- `source`: rentfaster | facebook_marketplace | other
- `unit_id` or general interest
- `contact_info`
- `status`: new | contacted | touring | applied | screened | leased | lost
- `created_at`

Note for Phase 2: RentFaster and Facebook Marketplace are a mixed intake today — worth
confirming per-platform whether inquiries arrive by email (parseable) or require manual
checking, since Facebook Marketplace has no reliable API for messages. This shapes how much
of lead intake can be automated vs. still needs a human glance.

### 7. Maintenance ticket
- `id`
- `unit_id`, `tenant_id`
- `description`, `priority`
- `status`: new | assigned | in_progress | resolved
- `vendor_id` (FK, optional)
- `cost` (optional)
- `created_at`, `resolved_at`

### 8. Vendor
- `id`
- `name`, `type` (e.g. handyman, plumber)
- `contact_info`

### 9. Communication log
- `id`
- `tenant_id` or `lead_id`
- `channel`: text | email | call
- `direction`: inbound | outbound
- `timestamp`, `summary`
- `handled_by`: agent | Alina | Ryan

### 10. Compliance record (CMHC annual reporting)
- `id`
- `project_entity_id` (FK)
- `year`
- `affordable_unit_rents_reported` (snapshot of rents for affordable units that year)
- `submitted_date`

## Users
Two roles to start — Ryan and Alina, both full access. No outside staff today, but the
permission model should be extensible in case that changes (e.g. an outsourced PM company,
per the §10 improvement directions).

## Open items carried into Phase 1
- Confirm trust sub-account setup for deposits with your bank/accountant.
- Confirm per-platform lead intake mechanics (RentFaster vs. Facebook Marketplace) before
  Phase 2 automation is scoped.

## Tech stack & integration notes
- **Hosting**: Railway or Render — managed app + Postgres in one place, no server admin
  required. Final pick made in Claude Code once the project is scaffolded.
- **Email**: Gmail API (OAuth) — Alina's existing inbox, no new email system needed.
- **Screening**: SingleKey API — credentials to be connected in Phase 2, not needed to start.
