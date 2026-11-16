import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyTwilioSignature } from "./twilio";

// Independently reproduces Twilio's own request-validation algorithm
// (https://www.twilio.com/docs/usage/security#validating-requests) rather
// than calling the same helper being tested, so a bug in the real
// implementation can't hide behind a test that just checks itself.
function signAsTwilio(url: string, params: Record<string, string>, authToken: string): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return crypto.createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

describe("verifyTwilioSignature", () => {
  const url = "https://leasing-and-pm-production.up.railway.app/api/sms/twilio-webhook";
  const authToken = "test-auth-token-123";
  const params = { From: "+15551234567", To: "+15559876543", Body: "Hello there" };

  it("accepts a correctly signed request", () => {
    const signature = signAsTwilio(url, params, authToken);
    expect(verifyTwilioSignature(url, params, signature, authToken)).toBe(true);
  });

  it("is order-independent for the params object, same as Twilio's own sort step", () => {
    const signature = signAsTwilio(url, params, authToken);
    const reordered = { Body: params.Body, From: params.From, To: params.To };
    expect(verifyTwilioSignature(url, reordered, signature, authToken)).toBe(true);
  });

  it("rejects a request with no signature header at all", () => {
    expect(verifyTwilioSignature(url, params, null, authToken)).toBe(false);
  });

  it("rejects a tampered parameter value", () => {
    const signature = signAsTwilio(url, params, authToken);
    const tampered = { ...params, Body: "Something else entirely" };
    expect(verifyTwilioSignature(url, tampered, signature, authToken)).toBe(false);
  });

  it("rejects an added or removed parameter", () => {
    const signature = signAsTwilio(url, params, authToken);
    const extra = { ...params, Extra: "sneaky" };
    expect(verifyTwilioSignature(url, extra, signature, authToken)).toBe(false);
  });

  it("rejects a signature computed with the wrong auth token", () => {
    const signature = signAsTwilio(url, params, "a-different-token");
    expect(verifyTwilioSignature(url, params, signature, authToken)).toBe(false);
  });

  it("rejects a signature meant for a different URL", () => {
    const signature = signAsTwilio("https://evil.example.com/webhook", params, authToken);
    expect(verifyTwilioSignature(url, params, signature, authToken)).toBe(false);
  });

  it("rejects garbage input without throwing", () => {
    expect(verifyTwilioSignature(url, params, "not-a-real-signature", authToken)).toBe(false);
  });
});
