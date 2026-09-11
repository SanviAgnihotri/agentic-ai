import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { clerkEnabled, getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  // Clerk renders its polished hosted UI when configured; the built-in form
  // keeps working without keys.
  if (clerkEnabled()) {
    return (
      <AuthShell>
        <SignIn forceRedirectUrl="/dashboard" signUpUrl="/sign-up" />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthForm mode="sign-in" />
    </AuthShell>
  );
}
