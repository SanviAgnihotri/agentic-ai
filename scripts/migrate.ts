/**
 * Runs pending Drizzle migrations against the configured database.
 * Usage: npm run db:migrate
 */
import { getDb } from "../src/db";

async function main() {
  await getDb();
  console.log("✓ Migrations applied");
  process.exit(0);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
