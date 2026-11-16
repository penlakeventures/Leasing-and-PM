import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { verifyDropboxSignWebhook } from "./dropbox-sign";

function signAsDropboxSign(eventTime: string, eventType: string, apiKey: string): string {
  return crypto.createHmac("sha256", apiKey).update(eventTime + eventType, "utf8").digest("hex");
}

describe("verifyDropboxSignWebhook", () => {
  const apiKey = "test-dropbox-sign-api-key";

  beforeEach(() => {
    process.env.DROPBOX_SIGN_API_KEY = apiKey;
  });

  afterEach(() => {
    delete process.env.DROPBOX_SIGN_API_KEY;
  });

  it("accepts a correctly computed event hash", () => {
    const eventTime = "1700000000";
    const eventType = "signature_request_signed";
    const eventHash = signAsDropboxSign(eventTime, eventType, apiKey);
    expect(verifyDropboxSignWebhook({ eventTime, eventType, eventHash })).toBe(true);
  });

  it("rejects a hash computed with the wrong api key", () => {
    const eventTime = "1700000000";
    const eventType = "signature_request_signed";
    const eventHash = signAsDropboxSign(eventTime, eventType, "a-different-key");
    expect(verifyDropboxSignWebhook({ eventTime, eventType, eventHash })).toBe(false);
  });

  it("rejects a hash that doesn't match a tampered event type", () => {
    const eventTime = "1700000000";
    const eventHash = signAsDropboxSign(eventTime, "signature_request_signed", apiKey);
    expect(
      verifyDropboxSignWebhook({ eventTime, eventType: "signature_request_declined", eventHash }),
    ).toBe(false);
  });

  it("throws clearly when the API key isn't configured, rather than silently passing", () => {
    delete process.env.DROPBOX_SIGN_API_KEY;
    expect(() =>
      verifyDropboxSignWebhook({ eventTime: "1", eventType: "x", eventHash: "y" }),
    ).toThrow(/DROPBOX_SIGN_API_KEY/);
  });
});
