export type ToolCategory =
  | "Search"
  | "Browser"
  | "Email"
  | "Communication"
  | "Calendar"
  | "Docs & Notes"
  | "Storage"
  | "Developer"
  | "Project Management"
  | "Social"
  | "CRM & Sales"
  | "Commerce"
  | "Analytics";

export interface ToolAction {
  /** Composio-style action id (uppercase). Used as the LLM tool name. */
  slug: string;
  name: string;
  description: string;
}

export interface CatalogTool {
  slug: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: string;
  color: string;
  requiresAuth: boolean;
  provider: "composio" | "builtin";
  toolkit?: string;
  actions: ToolAction[];
}

const tool = (t: CatalogTool): CatalogTool => t;

export const TOOL_CATALOG: CatalogTool[] = [
  tool({
    slug: "web_search",
    name: "Web Search",
    description:
      "Search the live web for news, articles, prices and any public information. Returns titles, URLs and snippets.",
    category: "Search",
    icon: "Search",
    color: "#0ea5e9",
    requiresAuth: false,
    provider: "builtin",
    actions: [
      {
        slug: "WEB_SEARCH",
        name: "Search the web",
        description: "Search the web for a query and return ranked results.",
      },
    ],
  }),
  tool({
    slug: "serpapi",
    name: "SERP API",
    description:
      "Structured search engine results with categories for jobs, maps, businesses, shopping and news.",
    category: "Search",
    icon: "Globe2",
    color: "#22c55e",
    requiresAuth: false,
    provider: "builtin",
    actions: [
      {
        slug: "SERP_GOOGLE_SEARCH",
        name: "Google search",
        description: "Run a structured Google search through SERP API.",
      },
      {
        slug: "SERP_GOOGLE_JOBS",
        name: "Search jobs",
        description: "Search job listings for a role and location.",
      },
    ],
  }),
  tool({
    slug: "browserbase",
    name: "Browserbase",
    description:
      "Launch a real cloud browser, visit pages, click, fill forms and extract live data from any website.",
    category: "Browser",
    icon: "AppWindow",
    color: "#8b5cf6",
    requiresAuth: false,
    provider: "builtin",
    actions: [
      {
        slug: "BROWSER_RESEARCH",
        name: "Browser research",
        description:
          "Complete a live browsing task on a website and return structured findings.",
      },
    ],
  }),
  tool({
    slug: "gmail",
    name: "Gmail",
    description:
      "Read, search and send email from your Gmail account. Great for digests, alerts and replies.",
    category: "Email",
    icon: "Mail",
    color: "#ea4335",
    requiresAuth: true,
    provider: "composio",
    toolkit: "gmail",
    actions: [
      {
        slug: "GMAIL_SEND_EMAIL",
        name: "Send email",
        description: "Send an email with subject and body.",
      },
      {
        slug: "GMAIL_FETCH_EMAILS",
        name: "Fetch emails",
        description: "Fetch and search emails from the inbox.",
      },
      {
        slug: "GMAIL_CREATE_EMAIL_DRAFT",
        name: "Create draft",
        description: "Create a draft email.",
      },
    ],
  }),
  tool({
    slug: "slack",
    name: "Slack",
    description:
      "Send messages, summaries and alerts to Slack channels or DMs.",
    category: "Communication",
    icon: "MessageSquare",
    color: "#611f69",
    requiresAuth: true,
    provider: "composio",
    toolkit: "slack",
    actions: [
      {
        slug: "SLACK_SEND_MESSAGE",
        name: "Send message",
        description: "Send a message to a Slack channel or DM.",
      },
      {
        slug: "SLACK_FETCH_CONVERSATION_HISTORY",
        name: "Read messages",
        description: "Read recent messages from a channel.",
      },
    ],
  }),
  tool({
    slug: "notion",
    name: "Notion",
    description:
      "Create and update pages and databases in your Notion workspace.",
    category: "Docs & Notes",
    icon: "NotebookText",
    color: "#111827",
    requiresAuth: true,
    provider: "composio",
    toolkit: "notion",
    actions: [
      {
        slug: "NOTION_CREATE_PAGE",
        name: "Create page",
        description: "Create a new page with markdown content.",
      },
      {
        slug: "NOTION_QUERY_DATABASE",
        name: "Query database",
        description: "Query a Notion database.",
      },
    ],
  }),
  tool({
    slug: "googledocs",
    name: "Google Docs",
    description:
      "Create documents and write structured reports straight to Google Docs.",
    category: "Docs & Notes",
    icon: "FileText",
    color: "#4285f4",
    requiresAuth: true,
    provider: "composio",
    toolkit: "googledocs",
    actions: [
      {
        slug: "GOOGLEDOCS_CREATE_DOCUMENT",
        name: "Create document",
        description: "Create a new Google Doc with a title and content.",
      },
      {
        slug: "GOOGLEDOCS_APPEND_TEXT",
        name: "Append text",
        description: "Append text to an existing document.",
      },
    ],
  }),
  tool({
    slug: "googlecalendar",
    name: "Google Calendar",
    description:
      "Read your schedule and create events, reminders and focus blocks.",
    category: "Calendar",
    icon: "CalendarDays",
    color: "#0f9d58",
    requiresAuth: true,
    provider: "composio",
    toolkit: "googlecalendar",
    actions: [
      {
        slug: "GOOGLECALENDAR_LIST_EVENTS",
        name: "List events",
        description: "List upcoming calendar events.",
      },
      {
        slug: "GOOGLECALENDAR_CREATE_EVENT",
        name: "Create event",
        description: "Create a calendar event.",
      },
    ],
  }),
  tool({
    slug: "googledrive",
    name: "Google Drive",
    description: "Upload, list and organise files in Google Drive.",
    category: "Storage",
    icon: "HardDrive",
    color: "#fbbc04",
    requiresAuth: true,
    provider: "composio",
    toolkit: "googledrive",
    actions: [
      {
        slug: "GOOGLEDRIVE_UPLOAD_FILE",
        name: "Upload file",
        description: "Upload a file to Drive.",
      },
      {
        slug: "GOOGLEDRIVE_FIND_FILE",
        name: "Find file",
        description: "Search for files in Drive.",
      },
    ],
  }),
  tool({
    slug: "googlesheets",
    name: "Google Sheets",
    description: "Append rows and read tables from Google Sheets.",
    category: "Docs & Notes",
    icon: "Table2",
    color: "#34a853",
    requiresAuth: true,
    provider: "composio",
    toolkit: "googlesheets",
    actions: [
      {
        slug: "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND",
        name: "Append row",
        description: "Append values to a spreadsheet.",
      },
      {
        slug: "GOOGLESHEETS_GET_SPREADSHEET_VALUES",
        name: "Read values",
        description: "Read values from a spreadsheet.",
      },
    ],
  }),
  tool({
    slug: "outlook",
    name: "Outlook",
    description:
      "Read and send mail from Microsoft Outlook, plus calendar events.",
    category: "Email",
    icon: "Mails",
    color: "#0078d4",
    requiresAuth: true,
    provider: "composio",
    toolkit: "outlook",
    actions: [
      {
        slug: "OUTLOOK_SEND_EMAIL",
        name: "Send email",
        description: "Send an email via Outlook.",
      },
      {
        slug: "OUTLOOK_LIST_MESSAGES",
        name: "List messages",
        description: "List recent Outlook messages.",
      },
    ],
  }),
  tool({
    slug: "github",
    name: "GitHub",
    description:
      "Track repositories, pull requests, issues and releases across your org.",
    category: "Developer",
    icon: "GitBranch",
    color: "#181717",
    requiresAuth: true,
    provider: "composio",
    toolkit: "github",
    actions: [
      {
        slug: "GITHUB_LIST_PULL_REQUESTS",
        name: "List pull requests",
        description: "List open pull requests for a repository.",
      },
      {
        slug: "GITHUB_CREATE_ISSUE",
        name: "Create issue",
        description: "Create a GitHub issue.",
      },
      {
        slug: "GITHUB_GET_REPOSITORY",
        name: "Get repository",
        description: "Get repository details.",
      },
    ],
  }),
  tool({
    slug: "reddit",
    name: "Reddit",
    description:
      "Find trending posts, discussions and sentiment in any subreddit.",
    category: "Social",
    icon: "Flame",
    color: "#ff4500",
    requiresAuth: true,
    provider: "composio",
    toolkit: "reddit",
    actions: [
      {
        slug: "REDDIT_GET_TOP_POSTS",
        name: "Get top posts",
        description: "Fetch top posts from a subreddit for a time range.",
      },
      {
        slug: "REDDIT_SEARCH_POSTS",
        name: "Search posts",
        description: "Search Reddit for a query.",
      },
    ],
  }),
  tool({
    slug: "discord",
    name: "Discord",
    description: "Post updates and summaries to Discord servers.",
    category: "Communication",
    icon: "Gamepad2",
    color: "#5865f2",
    requiresAuth: true,
    provider: "composio",
    toolkit: "discord",
    actions: [
      {
        slug: "DISCORD_SEND_MESSAGE",
        name: "Send message",
        description: "Send a message to a Discord channel.",
      },
    ],
  }),
  tool({
    slug: "twitter",
    name: "X / Twitter",
    description: "Search posts and publish updates to X.",
    category: "Social",
    icon: "Share2",
    color: "#0f1419",
    requiresAuth: true,
    provider: "composio",
    toolkit: "twitter",
    actions: [
      {
        slug: "TWITTER_CREATE_TWEET",
        name: "Create post",
        description: "Publish a post on X.",
      },
      {
        slug: "TWITTER_SEARCH_TWEETS",
        name: "Search posts",
        description: "Search recent posts on X.",
      },
    ],
  }),
  tool({
    slug: "telegram",
    name: "Telegram",
    description: "Send messages and alerts to Telegram chats.",
    category: "Communication",
    icon: "Send",
    color: "#229ed9",
    requiresAuth: true,
    provider: "composio",
    toolkit: "telegram",
    actions: [
      {
        slug: "TELEGRAM_SEND_MESSAGE",
        name: "Send message",
        description: "Send a Telegram message.",
      },
    ],
  }),
  tool({
    slug: "linear",
    name: "Linear",
    description: "Create and track issues in Linear projects.",
    category: "Project Management",
    icon: "Boxes",
    color: "#5e6ad2",
    requiresAuth: true,
    provider: "composio",
    toolkit: "linear",
    actions: [
      {
        slug: "LINEAR_CREATE_ISSUE",
        name: "Create issue",
        description: "Create a Linear issue.",
      },
      {
        slug: "LINEAR_LIST_ISSUES",
        name: "List issues",
        description: "List issues in a team.",
      },
    ],
  }),
  tool({
    slug: "jira",
    name: "Jira",
    description: "Create and query Jira issues and sprints.",
    category: "Project Management",
    icon: "ListChecks",
    color: "#0052cc",
    requiresAuth: true,
    provider: "composio",
    toolkit: "jira",
    actions: [
      {
        slug: "JIRA_CREATE_ISSUE",
        name: "Create issue",
        description: "Create a Jira issue.",
      },
    ],
  }),
  tool({
    slug: "trello",
    name: "Trello",
    description: "Add cards and move them across Trello boards.",
    category: "Project Management",
    icon: "KanbanSquare",
    color: "#0079bf",
    requiresAuth: true,
    provider: "composio",
    toolkit: "trello",
    actions: [
      {
        slug: "TRELLO_CREATE_CARD",
        name: "Create card",
        description: "Create a Trello card.",
      },
    ],
  }),
  tool({
    slug: "asana",
    name: "Asana",
    description: "Create tasks and update projects in Asana.",
    category: "Project Management",
    icon: "CircleCheckBig",
    color: "#f06a6a",
    requiresAuth: true,
    provider: "composio",
    toolkit: "asana",
    actions: [
      {
        slug: "ASANA_CREATE_TASK",
        name: "Create task",
        description: "Create an Asana task.",
      },
    ],
  }),
  tool({
    slug: "airtable",
    name: "Airtable",
    description: "Read and write records in Airtable bases.",
    category: "Docs & Notes",
    icon: "Grid3x3",
    color: "#18bfff",
    requiresAuth: true,
    provider: "composio",
    toolkit: "airtable",
    actions: [
      {
        slug: "AIRTABLE_CREATE_RECORD",
        name: "Create record",
        description: "Create an Airtable record.",
      },
    ],
  }),
  tool({
    slug: "dropbox",
    name: "Dropbox",
    description: "Upload and organise files in Dropbox.",
    category: "Storage",
    icon: "Package",
    color: "#0061ff",
    requiresAuth: true,
    provider: "composio",
    toolkit: "dropbox",
    actions: [
      {
        slug: "DROPBOX_UPLOAD_FILE",
        name: "Upload file",
        description: "Upload a file to Dropbox.",
      },
    ],
  }),
  tool({
    slug: "hubspot",
    name: "HubSpot",
    description: "Create contacts, deals and notes in HubSpot CRM.",
    category: "CRM & Sales",
    icon: "Contact",
    color: "#ff7a59",
    requiresAuth: true,
    provider: "composio",
    toolkit: "hubspot",
    actions: [
      {
        slug: "HUBSPOT_CREATE_CONTACT",
        name: "Create contact",
        description: "Create a HubSpot contact.",
      },
    ],
  }),
  tool({
    slug: "salesforce",
    name: "Salesforce",
    description: "Query leads, opportunities and accounts in Salesforce.",
    category: "CRM & Sales",
    icon: "Cloud",
    color: "#00a1e0",
    requiresAuth: true,
    provider: "composio",
    toolkit: "salesforce",
    actions: [
      {
        slug: "SALESFORCE_QUERY",
        name: "Run query",
        description: "Run a SOQL query.",
      },
    ],
  }),
  tool({
    slug: "stripe",
    name: "Stripe",
    description: "Track payments, subscriptions and customers.",
    category: "Commerce",
    icon: "CreditCard",
    color: "#635bff",
    requiresAuth: true,
    provider: "composio",
    toolkit: "stripe",
    actions: [
      {
        slug: "STRIPE_LIST_PAYMENTS",
        name: "List payments",
        description: "List recent payments.",
      },
    ],
  }),
  tool({
    slug: "shopify",
    name: "Shopify",
    description: "Monitor orders, products and revenue in Shopify.",
    category: "Commerce",
    icon: "ShoppingBag",
    color: "#96bf48",
    requiresAuth: true,
    provider: "composio",
    toolkit: "shopify",
    actions: [
      {
        slug: "SHOPIFY_LIST_ORDERS",
        name: "List orders",
        description: "List recent Shopify orders.",
      },
    ],
  }),
  tool({
    slug: "youtube",
    name: "YouTube",
    description: "Search videos, channels and comments.",
    category: "Social",
    icon: "MonitorPlay",
    color: "#ff0000",
    requiresAuth: true,
    provider: "composio",
    toolkit: "youtube",
    actions: [
      {
        slug: "YOUTUBE_SEARCH_VIDEOS",
        name: "Search videos",
        description: "Search YouTube videos.",
      },
    ],
  }),
  tool({
    slug: "calendly",
    name: "Calendly",
    description: "Read scheduled meetings and invitee details.",
    category: "Calendar",
    icon: "Clock",
    color: "#006bff",
    requiresAuth: true,
    provider: "composio",
    toolkit: "calendly",
    actions: [
      {
        slug: "CALENDLY_LIST_EVENTS",
        name: "List events",
        description: "List scheduled Calendly events.",
      },
    ],
  }),
  tool({
    slug: "zoom",
    name: "Zoom",
    description: "Create meetings and fetch recordings.",
    category: "Communication",
    icon: "Video",
    color: "#2d8cff",
    requiresAuth: true,
    provider: "composio",
    toolkit: "zoom",
    actions: [
      {
        slug: "ZOOM_CREATE_MEETING",
        name: "Create meeting",
        description: "Create a Zoom meeting.",
      },
    ],
  }),
];

export const toolBySlug = new Map(TOOL_CATALOG.map((t) => [t.slug, t]));

export const TOOL_CATEGORIES: ToolCategory[] = Array.from(
  new Set(TOOL_CATALOG.map((t) => t.category)),
);

/** Slugs handed to the config-generation model as the available tool list. */
export const defaultToolSlugs = TOOL_CATALOG.map((t) => t.slug);
