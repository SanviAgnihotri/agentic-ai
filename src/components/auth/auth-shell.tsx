import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";

const POINTS = [
  "Describe a task in plain English — get a fully configured agent",
  "Connect Gmail, Slack, Notion, GitHub, Docs and 100+ apps",
  "Agents run on a schedule with live browser automation",
  "Every step is logged, every result is saved",
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[oklch(0.16_0.03_286)] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-primary/[0.04] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="absolute -top-24 -left-24 size-96 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute -right-24 bottom-0 size-96 rounded-full bg-cyan-500/20 blur-3xl" />

        <Link href="/" className="relative flex items-center gap-3">
          <Image src="/logo.svg" alt="Groovy AI" width={40} height={40} />
          <span className="text-lg font-semibold text-white">Groovy AI</span>
        </Link>

        <div className="relative space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
            <Sparkles className="size-3.5 text-primary" />
            Your autonomous agent workforce
          </div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight text-white">
            Stop doing recurring work.
            <br />
            <span className="text-white/60">Start managing agents that do it.</span>
          </h2>
          <ul className="space-y-3">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-white/75">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-cyan-400" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-6 text-white/50">
          <div>
            <p className="text-2xl font-semibold text-white">5 min</p>
            <p className="text-xs">to your first agent</p>
          </div>
          <div className="h-8 w-px bg-white/15" />
          <div>
            <p className="text-2xl font-semibold text-white">100+</p>
            <p className="text-xs">app integrations</p>
          </div>
          <div className="h-8 w-px bg-white/15" />
          <div>
            <p className="text-2xl font-semibold text-white">24/7</p>
            <p className="text-xs">scheduled execution</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="flex w-full max-w-md flex-col items-center gap-8">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <Image src="/logo.svg" alt="Groovy AI" width={32} height={32} />
            <span className="font-semibold">Groovy AI</span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
