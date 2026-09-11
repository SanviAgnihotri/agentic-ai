import type { Metadata } from "next";
import { TemplatesView } from "@/components/templates/templates-view";

export const metadata: Metadata = { title: "Templates" };

// Pure client shell over the in-memory template catalog — fully static.
export const dynamic = "force-static";

export default function TemplatesPage() {
  return <TemplatesView />;
}
