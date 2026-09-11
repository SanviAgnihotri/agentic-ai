export interface QuickSuggestion {
  label: string;
  icon: string;
  prompt: string;
}

export const quickSuggestions: QuickSuggestion[] = [
  {
    label: "Inbox summarizer",
    icon: "Mail",
    prompt:
      "Every day at 8am, summarize my unread Gmail emails, highlight anything urgent, and send me a short digest on Slack.",
  },
  {
    label: "Trending topics",
    icon: "Flame",
    prompt:
      "Find the top 5 trending AI topics on Reddit, summarize them, write the report to a Google Doc and notify me on my personal Slack channel every day at 8am.",
  },
  {
    label: "Content researcher",
    icon: "Search",
    prompt:
      "Research my industry news every morning, find the most relevant articles, and save a research brief to Notion.",
  },
  {
    label: "Meeting organizer",
    icon: "CalendarDays",
    prompt:
      "Check my Google Calendar every evening, build a prioritized plan for tomorrow, and send it to my Slack DM.",
  },
  {
    label: "Job search assistant",
    icon: "Briefcase",
    prompt:
      "Search the web for new remote senior frontend roles every weekday at 9am and email me the best matches.",
  },
  {
    label: "Competitor watcher",
    icon: "Radar",
    prompt:
      "Monitor competitor pricing pages every Monday at 10am, summarize what changed, and post an update to our team Slack channel.",
  },
];
