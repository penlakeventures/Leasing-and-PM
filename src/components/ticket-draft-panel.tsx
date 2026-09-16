import { Card, Button, Field, Textarea, Select } from "@/components/ui";

export function TicketDraftPanel({
  draft,
  draftAction,
  createAction,
}: {
  draft: { description: string | null; priority: string | null };
  draftAction: (formData: FormData) => Promise<void>;
  createAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold text-neutral-900">Maintenance ticket</h2>

      {draft.description ? (
        <form action={createAction} className="space-y-4">
          <p className="text-xs text-neutral-500">
            AI-drafted from recent texts — review before creating
          </p>
          <Field label="Description" htmlFor="description">
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={draft.description}
              required
            />
          </Field>
          <Field label="Priority" htmlFor="priority">
            <Select id="priority" name="priority" defaultValue={draft.priority ?? "MEDIUM"}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </Field>
          <div className="flex gap-2">
            <Button type="submit">Create ticket</Button>
            <Button type="submit" variant="secondary" formAction={draftAction}>
              Redo
            </Button>
          </div>
        </form>
      ) : (
        <form action={draftAction}>
          <Button type="submit" variant="secondary">
            ✨ Draft a ticket from recent texts
          </Button>
        </form>
      )}
    </Card>
  );
}
