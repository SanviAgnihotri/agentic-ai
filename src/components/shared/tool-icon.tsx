import {
  AppWindow,
  Blocks,
  Bot,
  Boxes,
  Briefcase,
  CalendarDays,
  CircleCheckBig,
  Clock,
  Cloud,
  Contact,
  CreditCard,
  FileText,
  GitBranch,
  Flame,
  Gamepad2,
  Globe2,
  Grid3x3,
  HardDrive,
  KanbanSquare,
  Layers,
  LayoutDashboard,
  ListChecks,
  Mail,
  Mails,
  MessageSquare,
  MessagesSquare,
  NotebookPen,
  NotebookText,
  Package,
  PlayCircle,
  Radar,
  Search,
  Send,
  Share2,
  MonitorPlay,
  Settings,
  ShoppingBag,
  Sparkles,
  Table2,
  User,
  Video,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TOOL_CATALOG } from "@/agent/tools/catalog";

/** Real product marks (Simple Icons, CC0) served from /public/brands.
 *  `darkSrc` points at a near-white variant for logos whose brand fill is
 *  invisible on the dark canvas (GitHub, Notion, X, Slack, Salesforce). */
const BRAND_ICONS: Record<string, { src: string; darkSrc?: string }> = {
  gmail: { src: "/brands/gmail.png" },
  slack: { src: "/brands/slack.svg" },
  notion: { src: "/brands/notion.svg", darkSrc: "/brands/notion-dark.svg" },
  googledocs: { src: "/brands/googledocs.png" },
  googlecalendar: { src: "/brands/googlecalendar.png" },
  googledrive: { src: "/brands/googledrive.png" },
  googlesheets: { src: "/brands/googlesheets.png" },
  github: { src: "/brands/github.svg", darkSrc: "/brands/github-dark.svg" },
  reddit: { src: "/brands/reddit.svg" },
  discord: { src: "/brands/discord.svg" },
  twitter: { src: "/brands/twitter.svg", darkSrc: "/brands/twitter-dark.svg" },
  telegram: { src: "/brands/telegram.svg" },
  linear: { src: "/brands/linear.svg" },
  jira: { src: "/brands/jira.svg" },
  trello: { src: "/brands/trello.svg" },
  asana: { src: "/brands/asana.svg" },
  airtable: { src: "/brands/airtable.svg" },
  dropbox: { src: "/brands/dropbox.svg" },
  hubspot: { src: "/brands/hubspot.svg" },
  salesforce: { src: "/brands/salesforce.svg" },
  stripe: { src: "/brands/stripe.svg" },
  shopify: { src: "/brands/shopify.svg" },
  youtube: { src: "/brands/youtube.svg" },
  calendly: { src: "/brands/calendly.svg" },
  zoom: { src: "/brands/zoom.svg" },
};

export function brandSlugForToolNames(toolNames: string[]): string | null {
  for (const name of toolNames) {
    const tool = TOOL_CATALOG.find((entry) => entry.name === name);
    if (tool && BRAND_ICONS[tool.slug]) return tool.slug;
  }
  return null;
}

const ICONS: Record<string, LucideIcon> = {
  AppWindow,
  Blocks,
  Bot,
  Boxes,
  Briefcase,
  CalendarDays,
  CircleCheckBig,
  Clock,
  Cloud,
  Contact,
  CreditCard,
  FileText,
  GitBranch,
  Flame,
  Gamepad2,
  Globe2,
  Grid3x3,
  HardDrive,
  KanbanSquare,
  Layers,
  LayoutDashboard,
  ListChecks,
  Mail,
  Mails,
  MessageSquare,
  MessagesSquare,
  NotebookPen,
  NotebookText,
  Package,
  PlayCircle,
  Radar,
  Search,
  Send,
  Share2,
  MonitorPlay,
  Settings,
  ShoppingBag,
  Sparkles,
  Table2,
  User,
  Video,
  Workflow,
  Zap,
};

export function iconFor(name: string | null | undefined): LucideIcon {
  return (name && ICONS[name]) || Bot;
}

export function ToolIcon({
  name,
  slug,
  color,
  className = "size-4",
  fallback,
}: {
  name: string | null | undefined;
  slug?: string | null;
  color?: string | null;
  className?: string;
  fallback?: LucideIcon;
}) {
  const brand = slug ? BRAND_ICONS[slug] : undefined;
  if (brand) {
    // Near-black brand fills (GitHub, Notion, X, …) are invisible on the dark
    // canvas — those ships a near-white variant rendered in dark mode.
    if (brand.darkSrc) {
      return (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={brand.src}
            alt=""
            aria-hidden
            loading="lazy"
            className={cn(className, "dark:hidden")}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={brand.darkSrc}
            alt=""
            aria-hidden
            loading="lazy"
            className={cn(className, "hidden dark:block")}
          />
        </>
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brand.src}
        alt=""
        aria-hidden
        loading="lazy"
        className={cn(className, "object-contain")}
      />
    );
  }
  const Icon = (name && ICONS[name]) || fallback || Bot;
  // Near-black brand marks (Notion, GitHub, …) vanish on dark tiles — invert
  // them in dark mode so every icon stays visible.
  const isDarkColor = isDarkHex(color);
  return (
    <Icon
      className={cn(className, isDarkColor && "dark:invert")}
      style={color ? { color } : undefined}
    />
  );
}

function isDarkHex(color?: string | null): boolean {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return false;
  const r = parseInt(color.slice(1, 3), 16) / 255;
  const g = parseInt(color.slice(3, 5), 16) / 255;
  const b = parseInt(color.slice(5, 7), 16) / 255;
  // Relative luminance (sRGB approximation).
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.22;
}
