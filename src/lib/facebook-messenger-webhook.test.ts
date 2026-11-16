import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyMessengerSignature, parseMessengerPayload } from "./facebook-messenger-webhook";

function signAsMeta(rawBody: string, appSecret: string): string {
  return "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
}

describe("verifyMessengerSignature", () => {
  const appSecret = "test-app-secret";
  const rawBody = JSON.stringify({ object: "page", entry: [] });

  it("accepts a correctly signed payload", () => {
    const signature = signAsMeta(rawBody, appSecret);
    expect(verifyMessengerSignature(rawBody, signature, appSecret)).toBe(true);
  });

  it("rejects a missing signature header", () => {
    expect(verifyMessengerSignature(rawBody, null, appSecret)).toBe(false);
  });

  it("rejects an unsupported scheme (e.g. sha1 instead of sha256)", () => {
    const hex = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
    expect(verifyMessengerSignature(rawBody, `sha1=${hex}`, appSecret)).toBe(false);
  });

  it("rejects a malformed header with no '=' separator", () => {
    expect(verifyMessengerSignature(rawBody, "not-a-real-header", appSecret)).toBe(false);
  });

  it("rejects a tampered body signed with a different payload", () => {
    const signature = signAsMeta(rawBody, appSecret);
    const tamperedBody = JSON.stringify({ object: "page", entry: [{ sneaky: true }] });
    expect(verifyMessengerSignature(tamperedBody, signature, appSecret)).toBe(false);
  });

  it("rejects a signature made with the wrong app secret", () => {
    const signature = signAsMeta(rawBody, "a-different-secret");
    expect(verifyMessengerSignature(rawBody, signature, appSecret)).toBe(false);
  });
});

describe("parseMessengerPayload", () => {
  it("extracts a plain-text message from a well-formed payload", () => {
    const body = {
      object: "page",
      entry: [
        {
          messaging: [
            {
              sender: { id: "psid-123" },
              timestamp: 1700000000000,
              message: { mid: "mid-abc", text: "Is this still available?" },
            },
          ],
        },
      ],
    };
    expect(parseMessengerPayload(body)).toEqual([
      { psid: "psid-123", mid: "mid-abc", text: "Is this still available?", timestamp: 1700000000000 },
    ]);
  });

  it("ignores anything that isn't a Page object payload", () => {
    expect(parseMessengerPayload({ object: "user", entry: [] })).toEqual([]);
    expect(parseMessengerPayload(null)).toEqual([]);
    expect(parseMessengerPayload("just a string")).toEqual([]);
    expect(parseMessengerPayload(42)).toEqual([]);
  });

  it("skips delivery receipts, read receipts and postbacks (no message.text)", () => {
    const body = {
      object: "page",
      entry: [
        {
          messaging: [
            { sender: { id: "psid-1" }, delivery: { mids: ["mid-1"] } },
            { sender: { id: "psid-2" }, read: { watermark: 123 } },
            { sender: { id: "psid-3" }, postback: { payload: "GET_STARTED" } },
          ],
        },
      ],
    };
    expect(parseMessengerPayload(body)).toEqual([]);
  });

  it("collects messages across multiple entries and multiple senders", () => {
    const body = {
      object: "page",
      entry: [
        {
          messaging: [
            { sender: { id: "psid-1" }, timestamp: 1, message: { mid: "m1", text: "hi" } },
          ],
        },
        {
          messaging: [
            { sender: { id: "psid-2" }, timestamp: 2, message: { mid: "m2", text: "hello" } },
          ],
        },
      ],
    };
    expect(parseMessengerPayload(body)).toHaveLength(2);
  });

  it("defaults a missing timestamp to roughly now rather than throwing", () => {
    const body = {
      object: "page",
      entry: [
        { messaging: [{ sender: { id: "psid-1" }, message: { mid: "m1", text: "hi" } }] },
      ],
    };
    const [result] = parseMessengerPayload(body);
    expect(result.timestamp).toBeGreaterThan(Date.now() - 5000);
  });

  it("tolerates missing entry/messaging arrays without throwing", () => {
    expect(parseMessengerPayload({ object: "page" })).toEqual([]);
    expect(parseMessengerPayload({ object: "page", entry: [{}] })).toEqual([]);
    expect(parseMessengerPayload({ object: "page", entry: "not-an-array" })).toEqual([]);
  });
});
