/**
 * Runs once per server instance.
 *
 * Starts the built-in scheduler so recurring agents execute while the user is
 * away — even without an external Inngest account. The Inngest route provides
 * the production-grade path and both share the same atomic run claiming, so
 * they never double-execute a run.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SCHEDULER_DISABLED === "1") return;
  try {
    const { startScheduler } = await import("./agent/engine/scheduler");
    startScheduler();
  } catch (error) {
    console.error("[instrumentation] failed to start scheduler:", error);
  }
}
