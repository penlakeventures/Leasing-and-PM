import { Card, Button, LinkButton } from "@/components/ui";
import { getActiveConnection } from "@/lib/google-calendar";
import { disconnectCalendar } from "@/lib/actions/calendar";

export default async function CalendarSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const connection = await getActiveConnection();

  return (
    <div>
      <Card>
        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {connection ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-700">
              Connected as{" "}
              <span className="font-medium">{connection.googleEmail}</span>.
              Tours get booked on this account&apos;s primary calendar, with
              the assigned staff member and the lead (if their email is on
              file) invited as attendees.
            </p>
            <div className="flex gap-2">
              <LinkButton href="/api/calendar/connect" variant="secondary">
                Reconnect / switch account
              </LinkButton>
              <form action={disconnectCalendar}>
                <Button type="submit" variant="danger">
                  Disconnect
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-neutral-700">
              No Google account connected yet — tour scheduling on lead
              pages won&apos;t work until one is.
            </p>
            <LinkButton href="/api/calendar/connect">
              Connect Google Calendar
            </LinkButton>
          </div>
        )}
      </Card>
    </div>
  );
}
