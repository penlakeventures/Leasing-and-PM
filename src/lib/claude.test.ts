import { describe, it, expect } from "vitest";
import { buildDraftMessages, parseTicketDraft } from "./claude";

describe("buildDraftMessages", () => {
  it("maps INBOUND to user and OUTBOUND to assistant, with no synthetic turns needed", () => {
    // Starts and ends on an inbound (user) turn, so neither the
    // start-on-user nor end-on-user synthetic-turn rule should fire —
    // isolates the plain mapping from those two behaviors, tested
    // separately below.
    const messages = buildDraftMessages([
      { direction: "INBOUND", text: "Hi, is this still available?" },
      { direction: "OUTBOUND", text: "Yes it is!" },
      { direction: "INBOUND", text: "Great, what's the rent?" },
    ]);
    expect(messages).toEqual([
      { role: "user", content: "Hi, is this still available?" },
      { role: "assistant", content: "Yes it is!" },
      { role: "user", content: "Great, what's the rent?" },
    ]);
  });

  it("prepends a synthetic user turn for a brand new lead with no texts yet", () => {
    const messages = buildDraftMessages([]);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
  });

  it("prepends a synthetic user turn when staff texted first (no inbound yet)", () => {
    const messages = buildDraftMessages([{ direction: "OUTBOUND", text: "Just checking in!" }]);
    expect(messages[0].role).toBe("user");
    expect(messages[1]).toEqual({ role: "assistant", content: "Just checking in!" });
  });

  it("appends a synthetic user turn when the transcript already ends on staff's own message", () => {
    const messages = buildDraftMessages([
      { direction: "INBOUND", text: "Thanks!" },
      { direction: "OUTBOUND", text: "You're welcome!" },
    ]);
    expect(messages).toHaveLength(3);
    expect(messages[messages.length - 1].role).toBe("user");
  });

  it("leaves an already user-start/user-end transcript untouched", () => {
    const messages = buildDraftMessages([{ direction: "INBOUND", text: "Hello" }]);
    expect(messages).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("handles both a synthetic prepend and append together (staff-only, single outbound message)", () => {
    const messages = buildDraftMessages([{ direction: "OUTBOUND", text: "Hello?" }]);
    expect(messages).toHaveLength(3);
    expect(messages[0].role).toBe("user");
    expect(messages[1]).toEqual({ role: "assistant", content: "Hello?" });
    expect(messages[2].role).toBe("user");
  });
});

describe("parseTicketDraft", () => {
  it("parses a well-formed two-line response", () => {
    const result = parseTicketDraft("PRIORITY: URGENT\nDESCRIPTION: No heat, tenant reports furnace is off.");
    expect(result).toEqual({
      priority: "URGENT",
      description: "No heat, tenant reports furnace is off.",
    });
  });

  it("is case-insensitive on the priority label and value", () => {
    const result = parseTicketDraft("priority: high\ndescription: Fridge not cooling.");
    expect(result.priority).toBe("HIGH");
  });

  it("defaults to MEDIUM priority when the model's output doesn't match the expected format", () => {
    const result = parseTicketDraft("Something went wrong and there's no priority line at all.");
    expect(result.priority).toBe("MEDIUM");
  });

  it("falls back to the raw text as the description when DESCRIPTION: is missing", () => {
    const raw = "Just some unstructured text with no labels.";
    const result = parseTicketDraft(raw);
    expect(result.description).toBe(raw);
  });

  it("captures a multi-line description", () => {
    const result = parseTicketDraft(
      "PRIORITY: LOW\nDESCRIPTION: A scuff on the hallway wall.\nTenant says it's been there a while.",
    );
    expect(result.description).toBe("A scuff on the hallway wall.\nTenant says it's been there a while.");
  });
});
