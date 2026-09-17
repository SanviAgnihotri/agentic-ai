"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/components/user-provider";
import { authClient } from "@/lib/auth-client";
import { GitHubIcon, GoogleIcon } from "./provider-icons";

export type SocialProviders = {
  google: boolean;
  github: boolean;
};

/**
 * Email+password sign-in/sign-up, plus Google / GitHub when their credentials
 * are configured.
 */
export function BetterAuthForm({
  providers,
  mode = "sign-in",
}: {
  providers: SocialProviders;
  mode?: "sign-in" | "sign-up";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "github" | null>(null);

  const redirectUrl = searchParams.get("redirect_url") ?? "/dashboard";
  const signUp = mode === "sign-up";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = signUp
        ? await authClient.signUp.email({
            name: name.trim() || email.split("@")[0],
            email,
            password,
          })
        : await authClient.signIn.email({ email, password });
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
    // Social sign-up and sign-in share one endpoint: a first-time social
    // login creates the user, an existing email links the provider to it.
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: redirectUrl,
      requestSignUp: signUp,
    });
    if (error) {
      setError(error.message ?? `Could not start ${provider} sign-${signUp ? "up" : "in"}`);
      setSocialLoading(null);
    }
    // On success the browser is redirected to the provider by Better Auth.
  };

  const socialAvailable = providers.google || providers.github;

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {signUp ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {signUp
            ? "Sign up to manage your agents and their runs."
            : "Sign in to manage your agents and their runs."}
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
        {signUp && (
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ada Lovelace"
              autoComplete="name"
            />
          </div>
        )}
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
            placeholder={signUp ? "At least 8 characters" : "••••••••"}
            autoComplete={signUp ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
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
          {signUp ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {signUp ? (
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="font-medium text-foreground underline-offset-4 hover:underline">
              Sign up
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
