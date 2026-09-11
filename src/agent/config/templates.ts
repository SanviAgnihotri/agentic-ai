export interface AgentTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: "Productivity" | "Research" | "Communication" | "Engineering" | "Growth";
  icon: string;
  iconBackground: string;
  iconColor: string;
  border: string;
  glow: string;
  schedule: string;
  tools: string[];
  tags: string[];
}

export const agentTemplates: AgentTemplate[] = [
  {
    id: "inbox-zero",
    title: "Inbox Zero Digest",
    description:
      "Summarizes unread mail every morning, flags anything urgent and sends you a clean digest before you open your laptop.",
    prompt:
      "Every day at 7:30am, read my unread Gmail, summarize each thread in one line, flag urgent items, and send the digest to my Slack DM.",
    category: "Productivity",
    icon: "Mail",
    iconBackground: "bg-primary/10",
    iconColor: "text-primary",
    border: "hover:border-foreground/12",
    glow: "hover:shadow-apple-lg",
    schedule: "Daily · 7:30 AM",
    tools: ["Gmail", "Slack"],
    tags: ["Email", "Digest"],
  },
  {
    id: "reddit-trends",
    title: "Reddit Trend Radar",
    description:
      "Finds the top trending topics in any subreddit, summarizes them and files a report into a Google Doc automatically.",
    prompt:
      "Find the top 5 trending AI topics on Reddit from the past 24 hours, summarize them, write the result to my Google Docs and notify me on my personal Slack channel every day at 8am.",
    category: "Research",
    icon: "Flame",
    iconBackground: "bg-primary/10",
    iconColor: "text-primary",
    border: "hover:border-foreground/12",
    glow: "hover:shadow-apple-lg",
    schedule: "Daily · 8:00 AM",
    tools: ["Reddit", "Google Docs", "Slack"],
    tags: ["Trends", "Social"],
  },
  {
    id: "meeting-brief",
    title: "Morning Meeting Brief",
    description:
      "Scans your calendar at night, builds a prioritized plan of tomorrow's meetings and lands it in Slack or Notion.",
    prompt:
      "Every evening at 9pm, check my Google Calendar for tomorrow, create a prioritized plan of the meetings I should focus on, and send it to my Slack DM with preparation notes.",
    category: "Productivity",
    icon: "CalendarDays",
    iconBackground: "bg-primary/10",
    iconColor: "text-primary",
    border: "hover:border-foreground/12",
    glow: "hover:shadow-apple-lg",
    schedule: "Daily · 9:00 PM",
    tools: ["Google Calendar", "Slack"],
    tags: ["Calendar", "Planning"],
  },
  {
    id: "github-digest",
    title: "GitHub Pulse",
    description:
      "Tracks open PRs, stale issues and releases across your repos, then posts a weekly engineering pulse.",
    prompt:
      "Every Monday at 9am, review my GitHub repositories, summarize open pull requests that need attention, list new issues and releases from last week, and post the pulse to the team Slack channel.",
    category: "Engineering",
    icon: "GitBranch",
    iconBackground: "bg-primary/10",
    iconColor: "text-slate-700",
    border: "hover:border-foreground/12",
    glow: "hover:shadow-apple-lg",
    schedule: "Weekly · Monday 9:00 AM",
    tools: ["GitHub", "Slack"],
    tags: ["Dev", "PRs"],
  },
  {
    id: "competitor-watch",
    title: "Competitor Price Watch",
    description:
      "Browses competitor pricing pages on a schedule, detects changes and reports a diff with screenshots.",
    prompt:
      "Every Monday at 10am, open the pricing pages of our top 3 competitors in a browser, compare them with last week's numbers, and post a summary of any changes to our Slack channel.",
    category: "Growth",
    icon: "Radar",
    iconBackground: "bg-primary/10",
    iconColor: "text-primary",
    border: "hover:border-foreground/12",
    glow: "hover:shadow-apple-lg",
    schedule: "Weekly · Monday 10:00 AM",
    tools: ["Browserbase", "Slack"],
    tags: ["Competitor", "Browser"],
  },
  {
    id: "job-hunter",
    title: "Remote Job Hunter",
    description:
      "Searches the web for fresh remote roles matching your stack and emails you a curated shortlist every weekday.",
    prompt:
      "Search the web for new remote senior frontend engineer jobs posted in the last 24 hours, filter by React and Next.js, rank by salary if available, and email me the top 10 with links every weekday at 9am.",
    category: "Growth",
    icon: "Briefcase",
    iconBackground: "bg-primary/10",
    iconColor: "text-primary",
    border: "hover:border-foreground/12",
    glow: "hover:shadow-apple-lg",
    schedule: "Weekdays · 9:00 AM",
    tools: ["Web Search", "Gmail"],
    tags: ["Jobs", "Email"],
  },
  {
    id: "notion-notes",
    title: "Weekly Learning Notes",
    description:
      "Collects the best articles and videos on a topic each week and turns them into structured Notion notes.",
    prompt:
      "Every Friday at 4pm, search the web for the best new articles, docs and videos about AI agents from the past week, summarize each in 3 bullets, and save a structured summary page to my Notion workspace.",
    category: "Research",
    icon: "NotebookPen",
    iconBackground: "bg-primary/10",
    iconColor: "text-primary",
    border: "hover:border-foreground/12",
    glow: "hover:shadow-apple-lg",
    schedule: "Weekly · Friday 4:00 PM",
    tools: ["Web Search", "Notion"],
    tags: ["Learning", "Notion"],
  },
  {
    id: "slack-standup",
    title: "Team Standup Collector",
    description:
      "Reads your Slack standup channel, compiles blockers and ships a clean summary before the daily sync.",
    prompt:
      "Every weekday at 8:30am, read yesterday's messages in the #standup Slack channel, extract each teammate's update and blockers, and post a consolidated standup summary to #engineering.",
    category: "Communication",
    icon: "MessagesSquare",
    iconBackground: "bg-primary/10",
    iconColor: "text-primary",
    border: "hover:border-foreground/12",
    glow: "hover:shadow-apple-lg",
    schedule: "Weekdays · 8:30 AM",
    tools: ["Slack"],
    tags: ["Team", "Slack"],
  },
];
