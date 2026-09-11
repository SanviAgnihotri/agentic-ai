"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/hooks/use-poll";
import { useUser } from "@/components/user-provider";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const { refresh } = useUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const isSignUp = mode === "sign-up";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch(isSignUp ? "/api/auth/sign-up" : "/api/auth/sign-in", {
        method: "POST",
        json: isSignUp ? { name, email, password } : { email, password },
      });
      await refresh();
      toast.success(isSignUp ? "Welcome to Groovy AI" : "Welcome back");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const startDemo = async () => {
    setDemoLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/demo", { method: "POST" });
      await refresh();
      toast.success("Demo workspace ready", {
        description: "3 sample agents, runs and connections were created for you.",
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the demo");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isSignUp ? "Create your workspace" : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isSignUp
            ? "Start building autonomous agents in under a minute."
            : "Sign in to manage your agents and their runs."}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full gap-2 border-primary/30 bg-primary/5 hover:bg-primary/10"
        onClick={startDemo}
        disabled={demoLoading}
      >
        {demoLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4 text-primary" />
        )}
        Explore the live demo workspace
      </Button>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or continue with email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        {isSignUp && (
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ada Lovelace"
              autoComplete="name"
              required
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
            placeholder={isSignUp ? "At least 8 characters" : "••••••••"}
            autoComplete={isSignUp ? "new-password" : "current-password"}
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
          {isSignUp ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? "Already have an account?" : "New to Groovy AI?"}{" "}
        <Link
          href={isSignUp ? "/sign-in" : "/sign-up"}
          className="font-medium text-primary hover:underline"
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
