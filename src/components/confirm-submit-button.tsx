"use client";

import { Button } from "@/components/ui";
import { ReactNode } from "react";

export function ConfirmSubmitButton({
  children,
  confirmMessage,
  variant = "secondary",
}: {
  children: ReactNode;
  confirmMessage: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      onClick={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
