import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSignedFile, verifyDropboxSignWebhook } from "@/lib/dropbox-sign";
import { uploadFile } from "@/lib/dropbox";

// Dropbox Sign's own hard requirement: every callback — including the
// "test" ping sent from their dashboard when you first set the callback
// URL — must get back exactly this text, HTTP 200, or it's treated as a
// failure. After 10 consecutive failures the callback URL gets cleared
// automatically, so this isn't optional formatting.
const ACK = new NextResponse("Hello API Event Received", {
  status: 200,
  headers: { "Content-Type": "text/plain" },
});

type DropboxSignEvent = {
  event: { event_type: string; event_time: string; event_hash: string };
  signature_request?: { signature_request_id: string };
};

// Dropbox Sign posts multipart/form-data with a single field named "json"
// holding the actual event payload — unlike Twilio's flat form fields.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const raw = form.get("json");
  if (typeof raw !== "string") return ACK;

  let payload: DropboxSignEvent;
  try {
    payload = JSON.parse(raw);
  } catch {
    return ACK;
  }

  const { event_type: eventType, event_time: eventTime, event_hash: eventHash } = payload.event ?? {};
  if (!eventType || !eventTime || !eventHash) return ACK;
  if (!verifyDropboxSignWebhook({ eventTime, eventType, eventHash })) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 403 });
  }

  // Wait for one of these two "truly done" signals rather than acting on
  // the first individual signature — signature_request_signed fires once
  // per signer, and downloading right after the very last one can race
  // Dropbox Sign's own final-document assembly.
  if (eventType === "signature_request_all_signed" || eventType === "signature_request_downloadable") {
    const signatureRequestId = payload.signature_request?.signature_request_id;
    if (signatureRequestId) {
      await fileSignedLease(signatureRequestId);
    }
  }

  return ACK;
}

async function fileSignedLease(signatureRequestId: string): Promise<void> {
  const lease = await prisma.lease.findUnique({ where: { signatureRequestId } });
  // Already processed (the other of the two events above already handled
  // it), the request doesn't belong to a lease, or there's nowhere to
  // file it — none of these are errors worth retrying over.
  if (!lease || lease.signedDate || !lease.documentsFolderPath) return;

  try {
    const content = await getSignedFile(signatureRequestId);
    const testPrefix = lease.signatureTestMode ? "(TEST — not binding) " : "";
    await uploadFile({
      path: lease.documentsFolderPath,
      filename: `${testPrefix}Signed lease — ${signatureRequestId}.pdf`,
      content,
    });
    await prisma.lease.update({ where: { id: lease.id }, data: { signedDate: new Date() } });
    revalidatePath(`/leases/${lease.id}`);
  } catch (e) {
    // Left un-stamped on purpose — the next completion-flavored event for
    // this same request (or a manual retry) gets another chance, rather
    // than silently recording "signed" when the file never actually made
    // it to Dropbox.
    console.error("[dropbox-sign-webhook] fileSignedLease failed:", e);
  }
}
