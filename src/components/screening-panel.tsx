import { Card, Field, Input, Select, Textarea, Button, Badge } from "@/components/ui";
import { upsertScreening } from "@/lib/actions/screening";

type Screening = {
  requestedDate: Date | null;
  completedDate: Date | null;
  reportUrl: string | null;
  summary: string | null;
  decision: string;
  decisionNotes: string | null;
  decidedBy: { name: string } | null;
  decidedAt: Date | null;
} | null;

const decisionTone: Record<string, "neutral" | "green" | "red"> = {
  PENDING: "neutral",
  APPROVED: "green",
  DECLINED: "red",
};

export function ScreeningPanel({
  leadId,
  screening,
}: {
  leadId: string;
  screening: Screening;
}) {
  const action = upsertScreening.bind(null, leadId);
  const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">
          Tenant screening
        </h2>
        {screening && (
          <Badge tone={decisionTone[screening.decision]}>
            {screening.decision}
          </Badge>
        )}
      </div>
      <p className="mb-4 text-xs text-neutral-500">
        SingleKey (or similar) is requested on their site, not from here —
        this just keeps the outcome and the final call on file with
        everything else for this lead.
      </p>

      <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Report requested" htmlFor="requestedDate">
          <Input
            id="requestedDate"
            name="requestedDate"
            type="date"
            defaultValue={fmt(screening?.requestedDate ?? null)}
          />
        </Field>
        <Field label="Report completed" htmlFor="completedDate">
          <Input
            id="completedDate"
            name="completedDate"
            type="date"
            defaultValue={fmt(screening?.completedDate ?? null)}
          />
        </Field>
        <Field
          label="Report link"
          htmlFor="reportUrl"
          hint="Wherever the actual report lives — SingleKey, a saved PDF, etc."
        >
          <Input
            id="reportUrl"
            name="reportUrl"
            defaultValue={screening?.reportUrl ?? ""}
          />
        </Field>
        <Field label="Decision" htmlFor="decision">
          <Select
            id="decision"
            name="decision"
            defaultValue={screening?.decision ?? "PENDING"}
          >
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="DECLINED">Declined</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="Summary"
            htmlFor="summary"
            hint="Score/recommendation copied over from the report"
          >
            <Textarea
              id="summary"
              name="summary"
              defaultValue={screening?.summary ?? ""}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field
            label="Decision notes"
            htmlFor="decisionNotes"
            hint="Especially worth recording if declining — the reasoning on file"
          >
            <Textarea
              id="decisionNotes"
              name="decisionNotes"
              defaultValue={screening?.decisionNotes ?? ""}
            />
          </Field>
        </div>
        {screening?.decidedBy && screening.decidedAt && (
          <p className="text-xs text-neutral-500 sm:col-span-2">
            Decided by {screening.decidedBy.name} on{" "}
            {screening.decidedAt.toLocaleDateString()}
          </p>
        )}
        <div className="sm:col-span-2">
          <Button type="submit">
            {screening ? "Update screening" : "Save screening"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
