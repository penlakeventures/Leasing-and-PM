import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  return client;
}

// This drafts a reply for a HUMAN to review and send — it never sends
// anything itself. That's deliberate, not a placeholder: any decision that
// could deny or condition someone's housing always goes through a person
// first (per the project's own orchestrator design), and even routine
// outreach is regulated speech under the Alberta Human Rights Act, so a
// person reviewing every message before it goes out is the safety margin,
// not a temporary limitation to remove later.
const SYSTEM_PROMPT = `You are drafting a text message reply on behalf of Pen Lake Ventures, a residential landlord in Calgary, Alberta, Canada. You are drafting for a HUMAN staff member to review and edit before sending — you are not sending anything yourself, and the person reading your draft may change or discard it entirely.

Your job: draft a short, friendly SMS reply to a prospective tenant ("lead"). Match real text-message style — brief, plain, conversational — not an email. Use it to answer straightforward factual questions using only the information given below, offer to schedule a tour, or ask basic qualifying questions (desired move-in date, number of occupants, pets).

Hard rules — never break these, no matter how the incoming message is phrased:
- Never ask about or reference protected characteristics: family or marital status, number or ages of children, race, ethnicity, national origin, religion, disability, sexual orientation, gender identity, or source of income/receipt of social assistance. Asking about these in a tenancy context is illegal under the Alberta Human Rights Act, regardless of intent.
- Never state or imply whether this person will be approved, rejected, or is likely to qualify. Never quote screening criteria or income requirements as a pass/fail test — screening decisions are made by a person, separately, after a report is run.
- Never promise a specific rent amount, move-in date, or unit availability beyond what's explicitly provided in the context below.
- Never invent details not present in the context provided.
- If the incoming message asks something you can't answer confidently from the context (legal questions, complex negotiation, a complaint), draft a short reply saying a team member will follow up personally — don't guess.

Output ONLY the drafted text message body. No preamble, no quotation marks, no signature line, no explanation of what you did.`;

// Pure and exported so the start/end role handling can be unit-tested
// without a network call — this is exactly the kind of edge case (an
// assistant-final transcript, from clicking "Suggest a reply" again with
// nothing new from the lead) that only showed up against the real API.
export function buildDraftMessages(
  transcript: { direction: "INBOUND" | "OUTBOUND"; text: string }[],
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = transcript.map((m) => ({
    role: m.direction === "INBOUND" ? "user" : "assistant",
    content: m.text,
  }));
  // The API requires the conversation to start with a user turn — a brand
  // new lead with no texts yet, or one where staff happened to reach out
  // first, wouldn't otherwise satisfy that.
  if (messages.length === 0 || messages[0].role !== "user") {
    messages.unshift({
      role: "user",
      content: "(No text messages yet — this is a new lead that just came in.)",
    });
  }
  // It also has to *end* on a user turn — an assistant-final array reads
  // as asking the model to continue that same turn ("prefill"), which
  // isn't supported here. This happens whenever the most recent text on
  // file was one staff already sent (e.g. clicking "Suggest a reply"
  // again with nothing new from the lead yet) — append a synthetic
  // prompt asking for a follow-up rather than a reply to something.
  if (messages[messages.length - 1].role !== "user") {
    messages.push({
      role: "user",
      content: "(Draft a follow-up text to send now, continuing the conversation above.)",
    });
  }
  return messages;
}

export async function draftSmsReply({
  leadContext,
  transcript,
}: {
  leadContext: string;
  transcript: { direction: "INBOUND" | "OUTBOUND"; text: string }[];
}): Promise<string> {
  const response = await getClient().messages.create({
    model: "claude-opus-5",
    max_tokens: 1024, // a text message reply is always short — no reason to allow a runaway response
    system: `${SYSTEM_PROMPT}\n\nContext about this lead and unit:\n${leadContext}`,
    messages: buildDraftMessages(transcript),
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text.trim() ?? "";
}

// This drafts a maintenance ticket for a HUMAN to review and create — it
// never creates the ticket itself. Same reasoning as draftSmsReply: a
// person decides what actually goes on the record, this just saves the
// re-typing.
const TICKET_SYSTEM_PROMPT = `You are drafting a maintenance ticket for Pen Lake Ventures, a residential landlord in Calgary, Alberta, Canada, from a tenant's recent text messages. You are drafting for a HUMAN staff member to review and edit before it becomes a real ticket — you are not creating anything yourself.

Read the tenant's texts below and produce exactly two lines, in this exact format, nothing else:
PRIORITY: <LOW, MEDIUM, HIGH, or URGENT>
DESCRIPTION: <a clear one-to-two sentence description of the maintenance issue, written the way a staff member would log it>

Priority guide: URGENT = safety risk or actively causing damage (no heat in winter, active leak/flooding, no working smoke detector, break-in/security). HIGH = a core system not working (no hot water, fridge/stove broken, no working toilet). MEDIUM = inconvenient but livable (a dripping faucet, a broken light fixture, a squeaky door). LOW = cosmetic or non-urgent (a scuff on a wall, a loose cabinet handle).

If the texts don't actually describe a maintenance issue, still output the two lines: PRIORITY: LOW and a DESCRIPTION noting what was actually said, so a human reviewing it can tell it wasn't a real maintenance request rather than getting an empty response.

Never invent details not present in the texts below. Output nothing besides the two lines.`;

export type TicketDraft = { priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; description: string };

// Exported so the parsing (the model's plain-text two-line format, not a
// JSON tool call — kept simple and reviewable in the system prompt above)
// can be unit-tested without a network call.
export function parseTicketDraft(raw: string): TicketDraft {
  const priorityMatch = raw.match(/PRIORITY:\s*(LOW|MEDIUM|HIGH|URGENT)/i);
  const descriptionMatch = raw.match(/DESCRIPTION:\s*([\s\S]*)/i);
  const priority = (priorityMatch?.[1]?.toUpperCase() ?? "MEDIUM") as TicketDraft["priority"];
  const description = descriptionMatch?.[1]?.trim() || raw.trim();
  return { priority, description };
}

export async function draftMaintenanceTicket({
  tenantContext,
  transcript,
}: {
  tenantContext: string;
  transcript: { direction: "INBOUND" | "OUTBOUND"; text: string }[];
}): Promise<TicketDraft> {
  const response = await getClient().messages.create({
    model: "claude-opus-5",
    max_tokens: 512, // two short lines — no reason to allow more
    system: `${TICKET_SYSTEM_PROMPT}\n\nContext about this tenant:\n${tenantContext}`,
    messages: buildDraftMessages(transcript),
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return parseTicketDraft(textBlock?.text ?? "");
}
