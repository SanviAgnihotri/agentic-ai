import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sign-in problem" };

/**
 * Better Auth's OAuth error landing page (see `onAPIError.errorURL` in
 * `@/lib/better-auth`). Provider flows redirect here with
 * `?error=<code>&error_description=<text>`.
 */

const FRIENDLY: Record<string, { title: string; body: string }> = {
  account_not_linked: {
    title: "This email is already registered",
    body: "An account with this email exists but isn't linked to that provider yet. Sign in with your password first, then connect Google or GitHub from Settings → Connected accounts.",
  },
  email_does_not_match: {
    title: "That email doesn't match your account",
    body: "You're signed in, but the provider returned a different email address. Use the provider account that matches your account's email, or sign in again with the matching identity.",
  },
  email_not_verified: {
    title: "Your email isn't verified",
    body: "The provider reported your email as unverified. Verify it with the provider (Google/GitHub), then try again.",
  },
  email_not_found: {
    title: "No email on that provider account",
    body: "The provider didn't share an email address. Add a verified email to that account, then try again.",
  },
  unable_to_link_account: {
    title: "Couldn't connect that account",
    body: "The provider account couldn't be linked to your Groovy account. Try again, or use the same sign-in method you originally signed up with.",
  },
  account_already_linked_to_different_user: {
    title: "That account belongs to someone else",
    body: "This Google/GitHub account is already linked to a different Groovy account. Sign in with the method you originally used.",
  },
  forbidden: {
    title: "Sign-ups are closed",
    body: "This deployment is invite-only right now. Ask the owner to add your email to the allowlist, then try again.",
  },
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_description?: string }>;
}) {
  const { error, error_description } = await searchParams;
  const code = (error ?? "").toLowerCase();
  const friendly = FRIENDLY[code];

  return (
    <AuthShell>
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="text-sm">
            <h1 className="font-semibold text-destructive">
              {friendly?.title ?? "We couldn't complete that sign-in"}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {friendly?.body ??
                "Something went wrong while talking to the sign-in provider. Please try again."}
            </p>
          </div>
        </div>

        {code && !friendly ? (
          <p className="text-xs text-muted-foreground">
            Error code: <code className="font-mono">{code}</code>
            {error_description ? ` — ${error_description}` : null}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button asChild className="h-11 flex-1">
            <Link href="/sign-in">Back to sign in</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 flex-1">
            <Link href="/sign-up">Create a new account</Link>
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
