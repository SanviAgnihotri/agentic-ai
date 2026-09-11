import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { clerkEnabled, getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignUpPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  if (clerkEnabled()) {
    return (
      <AuthShell>
        <SignUp forceRedirectUrl="/dashboard" signInUrl="/sign-in" />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthForm mode="sign-up" />
    </AuthShell>
  );
}
