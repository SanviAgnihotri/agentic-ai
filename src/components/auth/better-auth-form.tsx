"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/components/user-provider";
import { authClient } from "@/lib/auth-client";

export type SocialProviders = {
  google: boolean;
  github: boolean;
};

/**
 * Sign-in only (registration is closed): email+password, plus Google / GitHub
 * when their credentials are configured.
 */
export function BetterAuthForm({ providers }: { providers: SocialProviders }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "github" | null>(null);

  const redirectUrl = searchParams.get("redirect_url") ?? "/dashboard";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        setError(error.message ?? "Something went wrong");
        return;
      }
      await refresh();
      router.push(redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const social = async (provider: "google" | "github") => {
    setError(null);
    setSocialLoading(provider);
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: redirectUrl,
    });
    if (error) {
      setError(error.message ?? `Could not start ${provider} sign-in`);
      setSocialLoading(null);
    }
    // On success the browser is redirected to the provider by Better Auth.
  };

  const socialAvailable = providers.google || providers.github;

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to manage your agents and their runs.
        </p>
      </div>

      {socialAvailable && (
        <div className="grid grid-cols-2 gap-3">
          {providers.google && (
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2"
              onClick={() => void social("google")}
              disabled={socialLoading !== null || loading}
            >
              {socialLoading === "google" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Google
            </Button>
          )}
          {providers.github && (
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2"
              onClick={() => void social("github")}
              disabled={socialLoading !== null || loading}
            >
              {socialLoading === "github" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <GitHubIcon />
              )}
              GitHub
            </Button>
          )}
        </div>
      )}

      {socialAvailable && (
        <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or continue with email
          <span className="h-px flex-1 bg-border" />
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" className="h-11 w-full gap-2" disabled={loading}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
          Sign in
        </Button>
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 5.04c1.62 0 3.06.56 4.2 1.64l3.12-3.12C17.46 1.8 14.96.75 12 .75 7.6.75 3.8 3.27 1.96 6.96l3.66 2.84C6.54 7.02 9.08 5.04 12 5.04Z"
      />
      <path
        fill="#4285F4"
        d="M23.25 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.3c-.27 1.46-1.09 2.7-2.32 3.53l3.62 2.8c2.12-1.96 3.65-4.84 3.65-8.52Z"
      />
      <path
        fill="#FBBC05"
        d="M5.62 14.2a6.9 6.9 0 0 1 0-4.4L1.96 6.96a11.27 11.27 0 0 0 0 10.08l3.66-2.84Z"
      />
      <path
        fill="#34A853"
        d="M12 23.25c3.04 0 5.6-1 7.46-2.72l-3.62-2.8c-1 .68-2.29 1.09-3.84 1.09-2.92 0-5.46-1.98-6.38-4.76l-3.66 2.84C3.8 19.23 7.6 23.25 12 23.25Z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.11-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.11-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.8 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.66.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}
