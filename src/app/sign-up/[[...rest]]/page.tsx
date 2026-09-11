import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Sign in" };

/**
 * Registration is closed (this deployment is invite-only) — the sign-up page
 * redirects to sign-in for anyone holding an old link.
 */
export default function SignUpPage() {
  redirect("/sign-in");
}
