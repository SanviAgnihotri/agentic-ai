"use client";

import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

/** Sign-out menu item for Clerk-managed sessions (rendered only in Clerk mode). */
export function ClerkSignOut() {
  const { signOut } = useClerk();
  const router = useRouter();

  return (
    <DropdownMenuItem
      onClick={() => {
        void signOut().then(() => {
          toast.success("Signed out");
          router.push("/");
        });
      }}
    >
      <LogOut />
      Sign out
    </DropdownMenuItem>
  );
}
