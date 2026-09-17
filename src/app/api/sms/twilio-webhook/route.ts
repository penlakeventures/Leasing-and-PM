import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyTwilioSignature, getSmsWebhookUrl } from "@/lib/twilio";
import { findContactByPhone, findOrCreateLeadForUnknownNumber } from "@/lib/sms-inbound";
import { triageInboundMessage } from "@/lib/orchestrator";

const EMPTY_TWIML = new NextResponse("<Response></Response>", {
  status: 200,
  headers: { "Content-Type": "text/xml" },
});

// Twilio calls this for every inbound text to the connected number. Every
// message lands on whichever tenant, lead, or vendor owns that phone
// number (an unrecognized number becomes a new lead, source OTHER) as an
// ongoing conversation, not a one-off note — mirrors the Facebook
// Messenger webhook's own append-to-existing-thread behaviour.
export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return NextResponse.json(
      { error: "TWILIO_AUTH_TOKEN isn't set in this deployment's environment variables." },
      { status: 500 },
    );
  }

  // Signature verification needs the exact raw form fields Twilio signed —
  // parsing via req.formData() and rebuilding params from it keeps that
  // intact (unlike req.json(), which wouldn't apply here anyway since
  // Twilio posts form-encoded, not JSON).
  const rawBody = await req.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));
  const signature = req.headers.get("x-twilio-signature");
  if (!verifyTwilioSignature(getSmsWebhookUrl(), params, signature, authToken)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 403 });
  }

  const from = params.From;
  const body = params.Body;
  const messageSid = params.MessageSid;
  if (!from || !body || !messageSid) {
    // Twilio also posts delivery-status callbacks and other event types to
    // the same kind of URL in some configurations — anything without an
    // actual inbound message isn't something to log.
    return EMPTY_TWIML;
  }

  const externalRef = `twilio:${messageSid}`;
  const existingLog = await prisma.communicationLog.findUnique({ where: { externalRef } });
  if (existingLog) return EMPTY_TWIML; // Twilio retried a delivery we already logged.

  const contact = await findContactByPhone(from);
  const logData = contact
    ? contact
    : { leadId: await findOrCreateLeadForUnknownNumber(from, body) };

  await prisma.communicationLog.create({
    data: {
      ...logData,
      channel: "TEXT",
      direction: "INBOUND",
      summary: body,
      handledById: null,
      externalRef,
    },
  });

  // The orchestrator: routes this text to the right specialist (a
  // maintenance ticket draft, a Q&A reply draft, or a lead reply draft)
  // so it's already waiting when someone opens the Inbox — never sends
  // anything itself, and a failure here never loses the message, which
  // is already safely logged above.
  await triageInboundMessage(logData, body);

  revalidatePath("/communications");
  revalidatePath("/inbox");
  revalidatePath("/");
  if ("tenantId" in logData) revalidatePath(`/tenants/${logData.tenantId}`);
  if ("leadId" in logData) revalidatePath(`/leads/${logData.leadId}`);
  if ("vendorId" in logData) revalidatePath(`/vendors/${logData.vendorId}`);

  return EMPTY_TWIML;
}
