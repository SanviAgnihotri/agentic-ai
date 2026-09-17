/**
 * Shared Telegram text helpers — used by the agent tool runtime (in-run
 * sends) and the run-finished notifier, so both chunk and clean text the
 * same way.
 */

/** Telegram hard-caps messages at 4096 chars; stay well below for footers. */
export const TELEGRAM_MAX_CHARS = 3800;

export function normalizeParseMode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "markdown") return "Markdown";
  if (normalized === "markdownv2") return "MarkdownV2";
  if (normalized === "html") return "HTML";
  return undefined;
}

/**
 * Telegram only renders <b>/<i> markup when a parse_mode is active. Whenever a
 * message goes out as plain text (multi-part splits, formatting retries),
 * convert the markup to clean text so users never see raw tags.
 */
export function toPlainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitTelegramText(text: string): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > TELEGRAM_MAX_CHARS) {
    const limit = TELEGRAM_MAX_CHARS;
    let cut = rest.lastIndexOf("\n\n", limit);
    if (cut < limit * 0.5) cut = rest.lastIndexOf("\n", limit);
    if (cut < limit * 0.5) cut = rest.lastIndexOf(" ", limit);
    if (cut < limit * 0.5) cut = limit;
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/**
 * True when the run already delivered a *substantial* Telegram message (an
 * actual deliverable, not a progress note) — used to avoid double-sending
 * when the auto-delivery and the model's own sends both exist.
 */
export const SUBSTANTIAL_SEND_CHARS = 800;

export function telegramDeliverableSent(
  steps: Array<{
    type: string;
    toolSlug?: string;
    input?: unknown;
    output?: unknown;
  }>,
): boolean {
  let pendingSendLength = 0;
  for (const step of steps) {
    if (step.toolSlug?.toUpperCase() !== "TELEGRAM_SEND_MESSAGE") continue;
    if (step.type === "tool_call") {
      const input = step.input as Record<string, unknown> | undefined;
      const text =
        typeof input?.text === "string"
          ? input.text
          : typeof input?.message === "string"
            ? input.message
            : "";
      pendingSendLength = text.length;
      continue;
    }
    if (step.type === "tool_result") {
      const output = step.output as Record<string, unknown> | undefined;
      const delivered =
        Boolean(output?.delivered) || Array.isArray(output?.message_ids);
      if (delivered && pendingSendLength >= SUBSTANTIAL_SEND_CHARS) return true;
      pendingSendLength = 0;
    }
  }
  return false;
}

/** The chat a run last delivered to, from its recorded tool results. */
export function telegramChatIdFromSteps(
  steps: Array<{
    type: string;
    toolSlug?: string;
    output?: unknown;
  }> | null | undefined,
): string | null {
  if (!Array.isArray(steps)) return null;
  for (const step of [...steps].reverse()) {
    if (step?.type !== "tool_result") continue;
    if (step.toolSlug?.toUpperCase() !== "TELEGRAM_SEND_MESSAGE") continue;
    const output = step.output as Record<string, unknown> | undefined;
    const chatId = output?.chat_id;
    if (typeof chatId === "string" && chatId.trim()) return chatId.trim();
    if (typeof chatId === "number") return String(chatId);
  }
  return null;
}

/**
 * Readable plain text for messages sent without a parse_mode (notifications).
 * Keeps the content — headings, bold, bullets, links — but drops the markdown
 * syntax characters Telegram would otherwise render literally.
 */
export function markdownToPlainText(value: string): string {
  return value
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2")
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
