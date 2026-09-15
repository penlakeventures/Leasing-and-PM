import { Card, Field, Input, Select, Button, LinkButton } from "@/components/ui";
import { scheduleTour, cancelTour } from "@/lib/actions/calendar";
import { TOUR_TIMEZONE } from "@/lib/google-calendar";

type Tour = {
  tourAt: Date | null;
  tourStaff: { name: string } | null;
};

export function TourPanel({
  leadId,
  tour,
  staff,
  calendarConnected,
}: {
  leadId: string;
  tour: Tour;
  staff: { id: string; name: string }[];
  calendarConnected: boolean;
}) {
  const scheduleAction = scheduleTour.bind(null, leadId);
  const cancelAction = cancelTour.bind(null, leadId);

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold text-neutral-900">
        Property tour
      </h2>

      {!calendarConnected ? (
        <p className="text-sm text-neutral-500">
          No Google Calendar connected yet —{" "}
          <LinkButton href="/settings/calendar" variant="secondary">
            connect one in Settings
          </LinkButton>{" "}
          before scheduling a tour.
        </p>
      ) : tour.tourAt ? (
        <div className="space-y-3">
          <p className="text-sm text-neutral-700">
            {tour.tourAt.toLocaleString("en-CA", {
              timeZone: TOUR_TIMEZONE,
              dateStyle: "full",
              timeStyle: "short",
            })}{" "}
            (Mountain Time) — {tour.tourStaff?.name ?? "unassigned"} showing
          </p>
          <form action={cancelAction}>
            <Button type="submit" variant="secondary">
              Cancel tour
            </Button>
          </form>
        </div>
      ) : (
        <form action={scheduleAction} className="flex flex-wrap items-end gap-3">
          <Field label="Date & time" htmlFor="tourDateTime" hint="Mountain Time">
            <Input
              id="tourDateTime"
              name="tourDateTime"
              type="datetime-local"
              required
            />
          </Field>
          <Field label="Staff" htmlFor="tourStaffId">
            <Select id="tourStaffId" name="tourStaffId" required>
              <option value="">Select…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit">Schedule tour</Button>
        </form>
      )}
    </Card>
  );
}
