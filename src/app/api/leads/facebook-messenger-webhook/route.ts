import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  verifyMessengerSignature,
  parseMessengerPayload,
  fetchMessengerSenderName,
} from "@/lib/facebook-messenger-webhook";

// Meta's one-time handshake when you register this URL as the Page's
// webhook: it sends these query params and expects the exact
// hub.challenge value echoed back, but only if hub.verify_token matches
// what you told Meta to expect — that's what actually proves you (not
// someone else) control this URL.
export async function GET(req: NextRequest) {
  const expected = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (!expected) {
    return NextResponse.json(
      {
        error:
          "FACEBOOK_WEBHOOK_VERIFY_TOKEN isn't set in this deployment's environment variables.",
      },
      { status: 500 },
    );
  }
  if (mode === "subscribe" && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed." }, { status: 403 });
}

// Meta calls this for every message event on the connected Page. Every
// captured message goes on a Lead (source FACEBOOK_MARKETPLACE, keyed by
// the sender's page-scoped ID) as an ongoing conversation, not a single
// snapshot — a second message from the same person appends to the same
// lead rather than creating a new one.
export async function POST(req: NextRequest) {
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json(
      {
        error:
          "FACEBOOK_APP_SECRET isn't set in this deployment's environment variables.",
      },
      { status: 500 },
    );
  }

  // Signature verification needs the exact raw bytes Meta sent — read as
  // text first, then parse, rather than req.json() (which wouldn't leave
  // the original bytes available to check against).
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifyMessengerSignature(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const messages = parseMessengerPayload(body);
  const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  let created = 0;
  let appended = 0;

  for (const msg of messages) {
    const commExternalRef = `messenger:${msg.mid}`;
    const existingLog = await prisma.communicationLog.findUnique({
      where: { externalRef: commExternalRef },
    });
    if (existingLog) continue; // Meta retried a delivery we already logged.

    const leadExternalRef = `messenger:${msg.psid}`;
    const existingLead = await prisma.lead.findUnique({
      where: { externalRef: leadExternalRef },
    });

    let leadId: string;
    if (existingLead) {
      await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          message: existingLead.message
            ? `${existingLead.message}\n\n${msg.text}`
            : msg.text,
        },
      });
      leadId = existingLead.id;
      appended++;
    } else {
      const contactName = pageAccessToken
        ? await fetchMessengerSenderName(msg.psid, pageAccessToken)
        : null;
      const lead = await prisma.lead.create({
        data: {
          source: "FACEBOOK_MARKETPLACE",
          contactName,
          message: msg.text,
          externalRef: leadExternalRef,
        },
      });
      leadId = lead.id;
      created++;
    }

    await prisma.communicationLog.create({
      data: {
        leadId,
        channel: "MESSENGER",
        direction: "INBOUND",
        summary: msg.text,
        handledById: null,
        externalRef: commExternalRef,
      },
    });
  }

  if (messages.length > 0) {
    revalidatePath("/leads");
    revalidatePath("/communications");
  }

  return NextResponse.json({ ok: true, created, appended });
}
