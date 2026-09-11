import { getDb, schema } from "@/db";
import { TOOL_CATALOG } from "@/agent/tools/catalog";

/** Mirror the catalog into the `tools` table (idempotent). */
export async function ensureToolsSeeded(): Promise<void> {
  const db = await getDb();
  const existing = await db
    .select({ id: schema.tools.id })
    .from(schema.tools)
    .limit(1)
    .catch(() => []);
  if (existing.length > 0) return;

  await db.insert(schema.tools).values(
    TOOL_CATALOG.map((tool) => ({
      slug: tool.slug,
      name: tool.name,
      description: tool.description,
      icon: tool.icon,
      category: tool.category,
      color: tool.color,
      requiresAuth: tool.requiresAuth,
      provider: tool.provider,
      toolkit: tool.toolkit ?? null,
      actions: tool.actions,
    })),
  );
}

