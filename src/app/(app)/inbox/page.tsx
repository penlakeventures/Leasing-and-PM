import { getInboxRows, type InboxRow } from "@/lib/inbox";
import { PageHeader, Card, Badge, Button, EmptyState } from "@/components/ui";
import Link from "next/link";

const tones: Record<InboxRow["kind"], "blue" | "green" | "amber"> = {
  Tenant: "blue",
  Lead: "green",
  Vendor: "amber",
};

export default async function InboxPage() {
  const rows = await getInboxRows();

  return (
    <div>
      <PageHeader
        title="Inbox"
        description="Texts waiting on a reply, newest first — clears itself once you reply, or click Dismiss if none is needed."
      />
      {rows.length === 0 ? (
        <EmptyState>Nothing waiting — every text has been replied to or dismissed.</EmptyState>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.key} className="flex items-center justify-between gap-4">
              <Link href={r.href} className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge tone={tones[r.kind]}>{r.kind}</Badge>
                  <span className="font-medium text-neutral-900">{r.name}</span>
                  {r.hasDraft && <Badge tone="neutral">✨ draft ready</Badge>}
                </div>
                <p className="mt-1 truncate text-sm text-neutral-600">{r.preview}</p>
                <p className="mt-1 text-xs text-neutral-400">{r.at.toLocaleString()}</p>
              </Link>
              <form action={r.dismissAction}>
                <Button type="submit" variant="secondary">
                  Dismiss
                </Button>
              </form>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
