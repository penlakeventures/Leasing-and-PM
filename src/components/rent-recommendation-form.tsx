import { Card, Field, Input, Textarea, Button } from "@/components/ui";

export function RentRecommendationForm({
  action,
}: {
  action: (formData: FormData) => void;
}) {
  return (
    <Card>
      <form action={action} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Proposed rent" htmlFor="proposedRent">
            <Input
              id="proposedRent"
              name="proposedRent"
              type="number"
              step="0.01"
              min={0}
              required
            />
          </Field>
        </div>
        <Field
          label="Reasoning"
          htmlFor="reasoning"
          hint="Comparables, how quickly they leased, season, anything else behind the number"
        >
          <Textarea id="reasoning" name="reasoning" required />
        </Field>
        <Button type="submit">Recommend this rent</Button>
      </form>
    </Card>
  );
}
