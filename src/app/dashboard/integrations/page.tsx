import type { Metadata } from "next";
import { IntegrationsView } from "@/components/integrations/integrations-view";

export const metadata: Metadata = { title: "Integrations" };

// Static shell — the overview is fetched client-side from /api/integrations.
export const dynamic = "force-static";

export default function IntegrationsPage() {
  return <IntegrationsView />;
}
