"use client";

import { useEffect, useState } from "react";
import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserMenu } from "./user-menu";

/**
 * Sidebar profile footer. Clicking the profile opens Clerk's built-in
 * "Manage account" modal (profile, security, sessions/devices, billing).
 * Users on the built-in session (demo workspace) get the classic menu with
 * sign-out instead.
 */
export function ClerkProfileButton() {
  const { isLoaded, isSignedIn, user } = useUser();
  const clerk = useClerk();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!(mounted && isLoaded && isSignedIn && user)) {
    return <UserMenu />;
  }

  const name = user.fullName || user.username || "Account";
  const email = user.primaryEmailAddress?.emailAddress ?? "";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => clerk.openUserProfile()}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1.5 text-left transition hover:bg-sidebar-accent"
      >
        <Avatar className="size-7 rounded-full border border-border">
          <AvatarImage src={user.imageUrl} alt={name} />
          <AvatarFallback className="rounded-full bg-muted text-xs text-primary">
            {name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium">{name}</p>
          {email && (
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          )}
        </div>
        <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
      </button>
      <button
        type="button"
        title="Sign out"
        aria-label="Sign out"
        onClick={() => {
          void clerk.signOut().then(() => {
            toast.success("Signed out");
            window.location.href = "/";
          });
        }}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}
