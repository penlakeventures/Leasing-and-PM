import { prisma } from "@/lib/prisma";
import { threadNeedsAttention } from "@/lib/rules";
import {
  dismissTenantAttention,
  dismissLeadAttention,
  dismissVendorAttention,
} from "@/lib/actions/inbox";

export type InboxRow = {
  key: string;
  kind: "Tenant" | "Lead" | "Vendor";
  name: string;
  href: string;
  preview: string;
  at: Date;
  hasDraft: boolean;
  dismissAction: (formData: FormData) => Promise<void>;
};

// Shared by the Inbox page and the Dashboard's "Needs a reply" count —
// one query, one definition of "needs attention" (threadNeedsAttention in
// rules.ts), so the two pages can't ever disagree with each other.
export async function getInboxRows(): Promise<InboxRow[]> {
  const [tenants, leads, vendors] = await Promise.all([
    prisma.tenant.findMany({
      where: { phone: { not: null } },
      include: { communications: { where: { channel: "TEXT" }, orderBy: { timestamp: "desc" }, take: 1 } },
    }),
    prisma.lead.findMany({
      where: { contactPhone: { not: null } },
      include: { communications: { where: { channel: "TEXT" }, orderBy: { timestamp: "desc" }, take: 1 } },
    }),
    prisma.vendor.findMany({
      where: { contactPhone: { not: null } },
      include: { communications: { where: { channel: "TEXT" }, orderBy: { timestamp: "desc" }, take: 1 } },
    }),
  ]);

  const rows: InboxRow[] = [];

  for (const t of tenants) {
    const last = t.communications[0] ?? null;
    if (!threadNeedsAttention({ lastMessage: last, attentionClearedAt: t.attentionClearedAt })) continue;
    rows.push({
      key: `tenant-${t.id}`,
      kind: "Tenant",
      name: t.name,
      href: `/tenants/${t.id}`,
      preview: last!.summary,
      at: last!.timestamp,
      hasDraft: Boolean(t.draftReply || t.draftTicketDescription),
      dismissAction: dismissTenantAttention.bind(null, t.id),
    });
  }

  for (const l of leads) {
    const last = l.communications[0] ?? null;
    if (!threadNeedsAttention({ lastMessage: last, attentionClearedAt: l.attentionClearedAt })) continue;
    rows.push({
      key: `lead-${l.id}`,
      kind: "Lead",
      name: l.contactName ?? "Lead",
      href: `/leads/${l.id}`,
      preview: last!.summary,
      at: last!.timestamp,
      hasDraft: Boolean(l.draftReply),
      dismissAction: dismissLeadAttention.bind(null, l.id),
    });
  }

  for (const v of vendors) {
    const last = v.communications[0] ?? null;
    if (!threadNeedsAttention({ lastMessage: last, attentionClearedAt: v.attentionClearedAt })) continue;
    rows.push({
      key: `vendor-${v.id}`,
      kind: "Vendor",
      name: v.name,
      href: `/vendors/${v.id}`,
      preview: last!.summary,
      at: last!.timestamp,
      hasDraft: false,
      dismissAction: dismissVendorAttention.bind(null, v.id),
    });
  }

  rows.sort((a, b) => b.at.getTime() - a.at.getTime());
  return rows;
}
