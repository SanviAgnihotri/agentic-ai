import * as schema from "./schema";
import type { PgliteDatabase } from "drizzle-orm/pglite";

/**
 * One database type for both drivers. PGlite (embedded Postgres, zero setup) is
 * used when no DATABASE_URL is configured — perfect for local dev and demos.
 * Point DATABASE_URL at any hosted Postgres (Aiven, Neon, RDS, Supabase) and
 * the same schema/queries keep working.
 *
 * Usage: `const db = await getDb();` — query builders can then chain normally.
 */
export type AppDb = PgliteDatabase<typeof schema>;

type DbGlobal = { ready?: Promise<AppDb> };
const globalForDb = globalThis as unknown as { __groovyDb?: DbGlobal };
const state: DbGlobal = (globalForDb.__groovyDb ??= {});

async function createDb(): Promise<AppDb> {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    let host = "";
    try {
      host = new URL(connectionString).hostname;
    } catch {
      host = "";
    }

    if (host.endsWith("neon.tech")) {
      const [{ neon }, { drizzle }, { migrate }] = await Promise.all([
        import("@neondatabase/serverless"),
        import("drizzle-orm/neon-http"),
        import("drizzle-orm/neon-http/migrator"),
      ]);
      const database = drizzle(neon(connectionString), { schema });
      try {
        await migrate(database as never, { migrationsFolder: "./drizzle" });
      } catch (error) {
        console.warn(
          "[db] Neon migration skipped:",
          error instanceof Error ? error.message : error,
        );
      }
      return database as unknown as AppDb;
    }

    // Standard Postgres (Aiven, RDS, Supabase, self-hosted): postgres-js over
    // TCP+TLS. sslmode comes from the connection string; default to requiring
    // TLS because cloud providers (Aiven) reject plaintext connections.
    const [{ default: postgres }, { drizzle }, { migrate }] = await Promise.all([
      import("postgres"),
      import("drizzle-orm/postgres-js"),
      import("drizzle-orm/postgres-js/migrator"),
    ]);
    const client = postgres(connectionString, {
      max: Number(process.env.PG_POOL_MAX ?? 10),
      ssl: connectionString.includes("sslmode=disable") ? false : "require",
      connect_timeout: 15,
    });
    const database = drizzle(client, { schema });
    await migrate(database as never, { migrationsFolder: "./drizzle" });
    return database as unknown as AppDb;
  }

  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  const dataDir = process.env.PGLITE_DATA_DIR || "./.data/pglite";
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  // Force UTC so `now()` matches the UTC timestamps Drizzle writes.
  // Without this, a non-UTC host timezone makes scheduled runs fire early
  // and live runs look "stale" immediately.
  await client.exec("SET TIME ZONE 'UTC'");
  const database = drizzle(client, { schema });
  await migrate(database, { migrationsFolder: "./drizzle" });
  return database;
}

/** Lazily initialise the database (and run migrations exactly once). */
export function getDb(): Promise<AppDb> {
  if (!state.ready) {
    state.ready = createDb().catch((error) => {
      state.ready = undefined;
      throw error;
    });
  }
  return state.ready;
}

export { schema };
