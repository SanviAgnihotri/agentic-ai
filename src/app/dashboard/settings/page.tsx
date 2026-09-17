import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { ConnectedAccounts } from "@/components/auth/connected-accounts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth";
import { getBetterAuth } from "@/lib/better-auth";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  // Passed from the server so the UI only offers providers this deployment
  // actually has credentials for (client bundles can't read server env vars).
  const providers = {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  };

  // Initial account list rendered server-side; the client re-reads after
  // disconnecting. `requireUser` above guarantees a session for this call.
  const auth = await getBetterAuth();
  const accounts = await auth.api.listUserAccounts({ headers: await headers() });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage how you sign in to your Groovy account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-muted-foreground" />
            Connected accounts
          </CardTitle>
          <CardDescription>
            All sign-in methods for <span className="font-medium text-foreground">{user.email}</span>{" "}
            share one account — connect Google or GitHub to sign in with either.
            Accounts are only ever linked when the email matches exactly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectedAccounts providers={providers} initialAccounts={accounts} />
        </CardContent>
      </Card>
    </div>
  );
}
