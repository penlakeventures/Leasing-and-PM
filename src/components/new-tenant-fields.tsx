"use client";

import { useId, useState } from "react";
import { Field, Input } from "@/components/ui";

// A brand-new lease's tenant(s), typed in here directly — repeatable for
// couples/roommates. Field names are the same across every block
// (newTenantName/Phone/Email, not indexed) — the server reads them with
// formData.getAll() and pairs them up by position, so removing a block
// from the middle doesn't break the pairing for the ones that remain.
export function NewTenantFields() {
  const [blocks, setBlocks] = useState<number[]>([0]);
  const nextIdBase = useId();
  const [nextId, setNextId] = useState(1);

  return (
    <div className="space-y-4">
      {blocks.map((blockId, i) => (
        <div key={blockId} className="rounded-md border border-neutral-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-700">
              Tenant {i + 1}
            </p>
            {blocks.length > 1 && (
              <button
                type="button"
                onClick={() => setBlocks((b) => b.filter((x) => x !== blockId))}
                className="text-xs text-neutral-500 underline"
              >
                Remove
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Name" htmlFor={`${nextIdBase}-name-${blockId}`}>
              <Input
                id={`${nextIdBase}-name-${blockId}`}
                name="newTenantName"
                required={i === 0}
              />
            </Field>
            <Field label="Phone" htmlFor={`${nextIdBase}-phone-${blockId}`} hint="Optional">
              <Input id={`${nextIdBase}-phone-${blockId}`} name="newTenantPhone" type="tel" />
            </Field>
            <Field label="Email" htmlFor={`${nextIdBase}-email-${blockId}`} hint="Optional">
              <Input id={`${nextIdBase}-email-${blockId}`} name="newTenantEmail" type="email" />
            </Field>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          setBlocks((b) => [...b, nextId]);
          setNextId((n) => n + 1);
        }}
        className="text-sm text-neutral-600 underline"
      >
        + Add another tenant
      </button>
    </div>
  );
}
