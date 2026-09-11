import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// Geist Sans + Mono — one family for the whole product, mono for code/IDs.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Clerk powers auth (and billing) when keys are present; without keys the
// built-in session auth keeps working — zero-config dev mode.
const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

export const metadata: Metadata = {
  title: {
    default: "Groovy AI — Your autonomous agent workforce",
    template: "%s · Groovy AI",
  },
  description:
    "Describe any recurring task in plain English and Groovy AI creates an autonomous agent that researches, writes, browses the web and reports back — on a schedule, while you sleep.",
  keywords: [
    "AI agents",
    "agent platform",
    "automation",
    "Next.js",
    "browser automation",
    "Composio",
  ],
  icons: {
    icon: "/logo.svg",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Theme comes from a cookie (set by the toggle) so the server renders the
  // right class pre-paint — no flash, and no React-rendered <script> tags.
  const store = await cookies();
  const theme = store.get("groovy-theme")?.value === "light" ? "light" : "dark";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${theme === "dark" ? "dark" : ""} h-full antialiased`}
      style={{ colorScheme: theme }}
    >
      <body className="flex min-h-full flex-col bg-background">
        {clerkEnabled ? (
          <ClerkProviderWrapper>{children}</ClerkProviderWrapper>
        ) : (
          <Providers>{children}</Providers>
        )}
      </body>
    </html>
  );
}

// Loaded lazily so the app runs with zero Clerk configuration.
async function ClerkProviderWrapper({ children }: { children: React.ReactNode }) {
  const [{ ClerkProvider }, { Providers }] = await Promise.all([
    import("@clerk/nextjs"),
    import("@/components/providers"),
  ]);
  return (
    <ClerkProvider>
      <Providers>{children}</Providers>
    </ClerkProvider>
  );
}
