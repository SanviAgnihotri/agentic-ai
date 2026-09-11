import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { BetterAuthForm } from "@/components/auth/better-auth-form";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  // Providers are passed from the server so the UI only offers what is
  // actually configured (client bundles can't read server env vars).
  const providers = {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  };

  return (
    <AuthShell>
      <BetterAuthForm providers={providers} />
    </AuthShell>
  );
}
