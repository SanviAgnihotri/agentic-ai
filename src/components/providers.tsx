"use client";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider } from "@/components/user-provider";
import { ThemeProvider } from "@/components/theme";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={150}>
        <UserProvider>{children}</UserProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "!rounded-xl !border-border/70",
            },
          }}
        />
      </TooltipProvider>
    </ThemeProvider>
  );
}
