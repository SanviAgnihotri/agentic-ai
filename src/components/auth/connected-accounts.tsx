"use client";

import { useState } from "react";
import { KeyRound, Loader2, Plug, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { GitHubIcon, GoogleIcon } from "./provider-icons";

export type SocialProviderId = "google" | "github";

export type AccountRow = { id: string; providerId: string };

const PROVIDER_LABEL: Record<string, string> = {
  credential: "Email & password",
  google: "Google",
  github: "GitHub",
};

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === "google") return <GoogleIcon />;
  if (provider === "github") return <GitHubIcon />;
  return <KeyRound className="size-4 text-muted-foreground" />;
}

/**
 * Connect/disconnect social accounts from an authenticated session.
 *
 * This is the secure linking path for password-first users: Better Auth only
 * implicitly links providers whose verified email matches the local user, so
 * accounts created with email+password (no verification email configured)
 * connect Google/GitHub here instead.
 */
export function ConnectedAccounts({
  providers,
  initialAccounts,
}: {
  providers: Record<SocialProviderId, boolean>;
  initialAccounts: AccountRow[];
}) {
  const [accounts, setAccounts] = useState<AccountRow[]>(initialAccounts);
  const [busy, setBusy] = useState<string | null>(null);

  // Re-read after a disconnect — connect flows leave the page entirely.
  const refresh = async () => {
    const { data, error } = await authClient.listAccounts();
    if (error) {
      toast.error(error.message ?? "Could not load connected accounts");
      return;
    }
    setAccounts((data as AccountRow[] | null) ?? []);
  };

  // A provider the server has no credentials for can never be connected.
  const configured: SocialProviderId[] = (["google", "github"] as const).filter(
    (provider) => providers[provider],
  );

  const rows: AccountRow[] = [
    ...accounts.filter((account) => account.providerId !== "credential"),
    ...configured
      .filter((provider) => !accounts.some((account) => account.providerId === provider))
      .map((provider) => ({ id: `available:${provider}`, providerId: provider })),
  ];

  const credential = accounts.find((account) => account.providerId === "credential");

  const connect = async (provider: SocialProviderId) => {
    setBusy(provider);
    const { error } = await authClient.linkSocial({
      provider,
      callbackURL: "/dashboard/settings",
    });
    if (error) {
      toast.error(error.message ?? `Could not connect ${PROVIDER_LABEL[provider]}`);
      setBusy(null);
    }
    // On success the browser is redirected to the provider by Better Auth.
  };

  const disconnect = async (account: AccountRow) => {
    setBusy(account.providerId);
    const { error } = await authClient.unlinkAccount({ accountId: account.id });
    if (error) {
      toast.error(error.message ?? `Could not disconnect ${PROVIDER_LABEL[account.providerId] ?? "account"}`);
    } else {
      toast.success(`Disconnected ${PROVIDER_LABEL[account.providerId] ?? "account"}`);
      await refresh();
    }
    setBusy(null);
  };

  return (
    <ul className="divide-y divide-border/60">
      {credential ? (
        <li className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div className="flex items-center gap-3">
            <ProviderIcon provider="credential" />
            <div className="text-sm">
              <p className="font-medium">Email & password</p>
              <p className="text-xs text-muted-foreground">
                Sign in with your password
              </p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Connected</span>
        </li>
      ) : null}

      {rows.length === 0 ? (
        <li className="py-3 text-sm text-muted-foreground first:pt-0 last:pb-0">
          {configured.length === 0
            ? "Google and GitHub sign-in are not configured on this deployment yet."
            : "No social accounts connected yet."}
        </li>
      ) : null}

      {rows.map((account) => {
        const pending = busy === account.providerId;
        const isPlaceholder = account.id.startsWith("available:");
        const isLastAccount = accounts.length <= 1;

        return (
          <li
            key={account.id}
            className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex items-center gap-3">
              <ProviderIcon provider={account.providerId} />
              <div className="text-sm">
                <p className="font-medium">
                  {PROVIDER_LABEL[account.providerId] ?? account.providerId}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isPlaceholder
                    ? `Connect your ${PROVIDER_LABEL[account.providerId]} account`
                    : "Used to sign in to this account"}
                </p>
              </div>
            </div>
            {isPlaceholder ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={busy !== null}
                onClick={() => void connect(account.providerId as SocialProviderId)}
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Plug className="size-3.5" />}
                Connect
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                disabled={busy !== null || isLastAccount}
                title={
                  isLastAccount
                    ? "You can't disconnect your only sign-in method"
                    : `Disconnect ${PROVIDER_LABEL[account.providerId]}`
                }
                onClick={() => void disconnect(account)}
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Unplug className="size-3.5" />}
                Disconnect
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
