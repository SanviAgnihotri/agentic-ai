"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot,
  Blocks,
  LayoutDashboard,
  Layers,
  Moon,
  PlayCircle,
  Plus,
  Search,
  Sun,
} from "lucide-react";
import { useTheme } from "@/components/theme";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { apiFetch } from "@/hooks/use-poll";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agents", href: "/dashboard/agents", icon: Bot },
  { label: "Runs", href: "/dashboard/runs", icon: PlayCircle },
  { label: "Integrations", href: "/dashboard/integrations", icon: Blocks },
  { label: "Templates", href: "/dashboard/templates", icon: Layers },
];

interface AgentOption {
  agentId: string;
  name: string | null;
  status: string | null;
}

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [agents, setAgents] = React.useState<AgentOption[]>([]);

  const crumb = React.useMemo(() => {
    const segments = pathname.split("/").filter(Boolean).slice(1);
    return segments.length > 0 ? segments.join(" / ") : "Dashboard";
  }, [pathname]);

  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    if (!open || agents.length > 0) return;
    void apiFetch<{ agents: AgentOption[] }>("/api/agent/configure")
      .then((data) => setAgents(data.agents ?? []))
      .catch(() => undefined);
  }, [open, agents.length]);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-background/80 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/65">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-5" />
      <Breadcrumb className="hidden sm:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Workspace</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="capitalize">{crumb}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="hidden h-9 w-56 justify-start gap-2 text-muted-foreground md:flex"
          onClick={() => setOpen(true)}
        >
          <Search className="size-3.5" />
          Search…
          <kbd className="pointer-events-none ml-auto inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium">
            ⌘K
          </kbd>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="size-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        <Button size="sm" className="h-9 gap-1.5" asChild>
          <Link href="/dashboard/agents?tab=create">
            <Plus className="size-4" />
            New agent
          </Link>
        </Button>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, agents and actions…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigate">
            {NAV.map((item) => (
              <CommandItem
                key={item.href}
                onSelect={() => {
                  setOpen(false);
                  router.push(item.href);
                }}
              >
                <item.icon className="size-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() => {
                setOpen(false);
                router.push("/dashboard/agents?tab=create");
              }}
            >
              <Plus className="size-4" />
              Create a new agent
            </CommandItem>
          </CommandGroup>
          {agents.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Agents">
                {agents.slice(0, 8).map((agent) => (
                  <CommandItem
                    key={agent.agentId}
                    onSelect={() => {
                      setOpen(false);
                      router.push(`/dashboard/agents/${agent.agentId}`);
                    }}
                  >
                    <Bot className="size-4" />
                    {agent.name ?? "Agent"}
                    <span className="ml-auto text-xs capitalize text-muted-foreground">
                      {agent.status}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </header>
  );
}
