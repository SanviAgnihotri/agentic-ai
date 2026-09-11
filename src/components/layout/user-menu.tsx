"use client";

import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Settings, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useUser } from "@/components/user-provider";
import { ClerkSignOut } from "@/components/layout/clerk-sign-out";
import { apiFetch } from "@/hooks/use-poll";

import { clerkClientEnabled as clerkEnabled } from "@/lib/clerk-client";

export function UserMenu() {
  const router = useRouter();
  const { user, setUser } = useUser();

  const signOut = async () => {
    // When Clerk manages the session, the <ClerkSignOut /> menu item ends the
    // Clerk session; the built-in cookie flow keeps working without keys.
    try {
      await apiFetch("/api/auth/sign-out", { method: "POST" });
      setUser(null);
      toast.success("Signed out");
      router.push("/");
    } catch {
      toast.error("Could not sign out");
    }
  };

  const initials = (user?.name ?? user?.email ?? "G")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <Avatar className="size-8 rounded-lg">
            <AvatarImage src={user?.imageUrl ?? undefined} alt={user?.name ?? "User"} />
            <AvatarFallback className="rounded-lg bg-muted text-xs text-muted-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{user?.name ?? "Groovy user"}</span>
            <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
          </div>
          <ChevronsUpDown className="ml-auto size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-xl"
        side="bottom"
        align="end"
        sideOffset={8}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="size-8 rounded-lg">
              <AvatarImage src={user?.imageUrl ?? undefined} alt={user?.name ?? "User"} />
              <AvatarFallback className="rounded-lg bg-muted text-xs text-muted-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user?.name ?? "Groovy user"}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user?.email}
              </span>
            </div>
            <Badge variant="secondary" className="capitalize">
              {user?.plan ?? "free"}
            </Badge>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {clerkEnabled ? (
          <ClerkSignOut />
        ) : (
          <DropdownMenuItem onClick={signOut}>
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
