// Phone numbers are stored as free text (however staff typed them in —
// "(403) 555-1234", "403-555-1234", etc.), but Twilio's webhook always
// sends E.164 ("+14035551234"). Comparing the last 10 digits sidesteps
// formatting and the leading North American country code without needing
// every stored number to be re-entered in one canonical format first.
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}
