import { Card, Textarea, Button } from "@/components/ui";

type Message = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  summary: string;
  timestamp: Date;
};

export function MessagePanel({
  messages,
  phone,
  sendAction,
  draftReply,
  draftAction,
}: {
  messages: Message[];
  phone: string | null;
  sendAction: (formData: FormData) => Promise<void>;
  // Only leads get AI-drafted suggestions today (Phase 2 lead response) —
  // omit both on the Tenant page.
  draftReply?: string | null;
  draftAction?: (formData: FormData) => Promise<void>;
}) {
  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold text-neutral-900">Texts</h2>

      {!phone ? (
        <p className="text-sm text-neutral-500">
          No phone number on file — add one to send or receive texts here.
        </p>
      ) : (
        <>
          {messages.length === 0 ? (
            <p className="mb-4 text-sm text-neutral-500">
              No texts yet — messages to and from {phone} will show up here.
            </p>
          ) : (
            <div className="mb-4 flex max-h-96 flex-col gap-2 overflow-y-auto">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    m.direction === "OUTBOUND"
                      ? "ml-auto bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-900"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.summary}</p>
                  <p
                    className={`mt-1 text-xs ${
                      m.direction === "OUTBOUND" ? "text-neutral-300" : "text-neutral-500"
                    }`}
                  >
                    {m.timestamp.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          {draftAction && (
            <form action={draftAction} className="mb-3">
              <Button type="submit" variant="secondary">
                ✨ Suggest a reply
              </Button>
            </form>
          )}

          <form action={sendAction} className="flex gap-2">
            <div className="flex-1">
              {draftReply && (
                <p className="mb-1 text-xs text-neutral-500">
                  AI-drafted — review before sending
                </p>
              )}
              <Textarea
                name="body"
                rows={2}
                placeholder={`Text ${phone}…`}
                defaultValue={draftReply ?? undefined}
                required
              />
            </div>
            <Button type="submit">Send</Button>
          </form>
        </>
      )}
    </Card>
  );
}
