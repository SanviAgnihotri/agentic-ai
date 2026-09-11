/**
 * Client-side Clerk flag. Only the publishable key survives into client
 * bundles (CLERK_SECRET_KEY is server-only), so gating must not check it.
 */
export const clerkClientEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);
