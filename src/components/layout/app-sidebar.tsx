"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Blocks,
  Bot,
  CreditCard,
  LayoutDashboard,
  Layers,
  PlayCircle,
  Settings,
  Sparkles,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useUser } from "@/components/user-provider";
import { FREE_USAGE_CREDITS, PRO_USAGE_CREDITS } from "@/lib/plans";
import { UserMenu } from "./user-menu";

/** Visible upgrade CTA (or a Pro badge once subscribed). */
function UpgradeCta() {
  const { user } = useUser();

  if (user?.plan === "pro") {
    return (
      <Link
        href="/dashboard/billing"
        className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Sparkles className="size-2.5" />
        Pro plan
      </Link>
    );
  }
  return (
    <Button size="sm" className="mt-2 h-7 w-full gap-1 text-xs" asChild>
      <Link href="/pricing">
        <Sparkles className="size-3" />
        Upgrade
      </Link>
    </Button>
  );
}

const WORKSPACE_ITEMS = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Agents", href: "/dashboard/agents", icon: Bot },
  { title: "Runs", href: "/dashboard/runs", icon: PlayCircle },
  {
    title: "Integrations",
    href: "/dashboard/integrations",
    icon: Blocks,
  },
  { title: "Templates", href: "/dashboard/templates", icon: Layers },
];

const ACCOUNT_ITEMS = [
  { title: "Billing", href: "/dashboard/billing", icon: CreditCard },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
] satisfies Array<{ title: string; href: string; icon: typeof CreditCard }>;

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();

  const credits = user?.usageCredits ?? FREE_USAGE_CREDITS;
  const total = user?.plan === "pro" ? PRO_USAGE_CREDITS : FREE_USAGE_CREDITS;
  const percent = Math.max(0, Math.min(100, Math.round((credits / total) * 100)));


  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="gap-2.5">
              <Link href="/dashboard">
                <div className="flex size-9 items-center justify-center">
                  <Image src="/logo.svg" alt="Groovy AI" width={30} height={30} />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-[15px] font-semibold">Groovy AI</span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    Agent workspace
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {WORKSPACE_ITEMS.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.title}
                      asChild
                      className="h-10"
                    >
                      <Link href={item.href}>
                        <item.icon className="size-4 text-muted-foreground" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ACCOUNT_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.title}
                      asChild
                      className="h-10"
                    >
                      <Link href={item.href}>
                        <item.icon className="size-4 text-muted-foreground" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      <SidebarFooter className="gap-3 p-3">
        <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Sparkles className="size-3.5 text-primary" />
              Usage credits
            </span>
            <span className="tabular-nums text-muted-foreground">
              {credits.toLocaleString("en")}/{total.toLocaleString("en")}
            </span>
          </div>
          <Progress
            value={percent}
            aria-label={`Usage credits: ${percent}% left`}
            className="mt-2 h-1.5"
          />
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            Each tool call uses one credit. Resets on your plan renewal.
          </p>
          <UpgradeCta />
        </div>
        <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
