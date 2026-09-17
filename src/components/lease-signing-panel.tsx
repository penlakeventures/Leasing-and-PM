import { Card, Field, Input, Textarea, Button, Badge } from "@/components/ui";
import type { LeaseMergeFields } from "@/lib/lease-document";

export function LeaseSigningPanel({
  periodic,
  hasEndDate,
  signatureRequestId,
  signatureSentAt,
  signedDate,
  defaults,
  sendAction,
}: {
  periodic: boolean;
  hasEndDate: boolean;
  signatureRequestId: string | null;
  signatureSentAt: Date | null;
  signedDate: Date | null;
  defaults: LeaseMergeFields;
  sendAction: (formData: FormData) => Promise<void>;
}) {
  if (periodic || !hasEndDate) {
    return (
      <Card>
        <h2 className="mb-2 text-sm font-semibold text-neutral-900">Send for signature</h2>
        <p className="text-sm text-neutral-500">
          Only a fixed-term lease (with an end date) can be sent for signature from here —
          periodic leases are handled outside the app.
        </p>
      </Card>
    );
  }

  if (signatureRequestId) {
    return (
      <Card>
        <h2 className="mb-2 text-sm font-semibold text-neutral-900">Signature request</h2>
        {signedDate ? (
          <p className="text-sm">
            <Badge tone="green">Fully signed</Badge>{" "}
            {signedDate.toLocaleDateString()} — the signed document was filed to this lease&apos;s
            Dropbox folder automatically.
          </p>
        ) : (
          <p className="text-sm">
            <Badge tone="amber">Sent — awaiting signatures</Badge>{" "}
            {signatureSentAt && `on ${signatureSentAt.toLocaleDateString()}`}. This updates
            automatically once everyone&apos;s signed.
          </p>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold text-neutral-900">Send for signature</h2>
      <p className="mb-4 text-xs text-neutral-500">
        Review the values below before sending — this is what actually ends up on the signed
        lease and the Smoking/Cannabis Addendum, sent together as one signing request.
      </p>
      <form action={sendAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Agreement date" htmlFor="agreement_date">
          <Input id="agreement_date" name="agreement_date" defaultValue={defaults.agreement_date} />
        </Field>
        <Field label="Landlord name" htmlFor="landlord_name">
          <Input id="landlord_name" name="landlord_name" defaultValue={defaults.landlord_name} />
        </Field>
        <Field label="Tenant 1" htmlFor="tenant_name_1">
          <Input id="tenant_name_1" name="tenant_name_1" defaultValue={defaults.tenant_name_1} />
        </Field>
        <Field label="Tenant 2" htmlFor="tenant_name_2" hint="Leave blank if only one tenant">
          <Input id="tenant_name_2" name="tenant_name_2" defaultValue={defaults.tenant_name_2} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Premises" htmlFor="premises" hint="The exact civic address — worth double-checking">
            <Input id="premises" name="premises" defaultValue={defaults.premises} />
          </Field>
        </div>
        <Field label="Term start" htmlFor="term_start">
          <Input id="term_start" name="term_start" defaultValue={defaults.term_start} />
        </Field>
        <Field label="Term end" htmlFor="term_end">
          <Input id="term_end" name="term_end" defaultValue={defaults.term_end} />
        </Field>
        <Field label="Rent amount" htmlFor="rent_amount">
          <Input id="rent_amount" name="rent_amount" defaultValue={defaults.rent_amount} />
        </Field>
        <div />
        <Field label="Partial rent amount" htmlFor="partial_rent_amount" hint="Only if move-in isn't the 1st">
          <Input
            id="partial_rent_amount"
            name="partial_rent_amount"
            defaultValue={defaults.partial_rent_amount}
          />
        </Field>
        <Field label="Partial rent period" htmlFor="partial_rent_period">
          <Input
            id="partial_rent_period"
            name="partial_rent_period"
            defaultValue={defaults.partial_rent_period}
          />
        </Field>
        <Field label="Deposit amount" htmlFor="deposit_amount">
          <Input id="deposit_amount" name="deposit_amount" defaultValue={defaults.deposit_amount} />
        </Field>
        <Field label="Deposit date" htmlFor="deposit_date">
          <Input id="deposit_date" name="deposit_date" defaultValue={defaults.deposit_date} />
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="Additional custom terms"
            htmlFor="custom_terms_text"
            hint="Optional — if filled in, the Additional Lease Terms addendum is included too"
          >
            <Textarea id="custom_terms_text" name="custom_terms_text" defaultValue={defaults.custom_terms_text ?? ""} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">Send for signature</Button>
        </div>
      </form>
    </Card>
  );
}
