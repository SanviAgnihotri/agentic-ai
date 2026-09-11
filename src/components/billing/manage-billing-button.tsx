"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/hooks/use-poll";

/** Opens the hosted Dodo Payments customer portal (invoices, payment method, plan changes). */
export function ManageBillingButton({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
}) {
  const [pending, setPending] = useState(false);

  async function openPortal() {
    setPending(true);
    try {
      const data = await apiFetch<{ url: string }>("/api/billing/portal", {
        method: "POST",
      });
      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open billing");
      setPending(false);
    }
  }

  return (
    <Button
      variant={variant}
      className={className}
      onClick={openPortal}
      disabled={pending}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      Manage billing
    </Button>
  );
}
