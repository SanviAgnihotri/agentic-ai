/**
 * Dev utility: insert a scheduled run that is already due, to verify the
 * built-in scheduler end-to-end. Run with the dev server stopped.
 */
import { getDb, schema } from "../src/db";

async function main() {
  const db = await getDb();
  const due = new Date(Date.now() - 60_000);
  const inserted = await db
    .insert(schema.agentRun)
    .values({
      agentId: "demo-reddit-radar",
      userEmail: "demo@groovy.ai",
      scheduleFor: due,
      timeZone: "Asia/Calcutta",
      status: "scheduled",
      trigger: "schedule",
    })
    .returning({ id: schema.agentRun.id });
  console.log("inserted due run:", inserted[0].id);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
