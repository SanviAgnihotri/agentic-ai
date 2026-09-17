"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Layers, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { iconFor, ToolIcon, brandSlugForToolNames } from "@/components/shared/tool-icon";
import { agentTemplates } from "@/agent/config/templates";
import { toolBySlug } from "@/agent/tools/catalog";

const CATEGORIES = [
  "All",
  "Productivity",
  "Research",
  "Communication",
  "Engineering",
  "Growth",
] as const;

type Category = (typeof CATEGORIES)[number];

export function TemplatesView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCategory = searchParams.get("category") as Category | null;
  const [category, setCategory] = useState<Category>(
    urlCategory && CATEGORIES.includes(urlCategory) ? urlCategory : "All",
  );

  const selectCategory = (value: Category) => {
    setCategory(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value === "All") params.delete("category");
    else params.set("category", value);
    const qs = params.toString();
    router.replace(qs ? `/dashboard/templates?${qs}` : "/dashboard/templates", {
      scroll: false,
    });
  };

  const templates =
    category === "All"
      ? agentTemplates
      : agentTemplates.filter((template) => template.category === category);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Layers className="size-5 text-amber-500" />
            Templates
          </h1>
          <p className="text-sm text-muted-foreground">
            Production-ready agent recipes. Load one and customize it in seconds.
          </p>
        </div>
        <Button variant="outline" className="gap-2" asChild>
          <Link href="/dashboard/agents?tab=create">
            <Sparkles className="size-4" />
            Start from scratch
          </Link>
        </Button>
      </div>

      <Tabs value={category} onValueChange={(value) => selectCategory(value as Category)}>
        <TabsList className="h-9 flex-wrap">
          {CATEGORIES.map((item) => (
            <TabsTrigger key={item} value={item} className="text-xs">
              {item}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {templates.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No templates in this category yet"
          description="Pick another category or start from scratch to build your own agent."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => {
          const Icon = iconFor(template.icon);
          const brandSlug = brandSlugForToolNames(template.tools);
          return (
            <Card
              key={template.id}
              className={`group flex flex-col border-border/70 transition-colors hover:border-foreground/15 `}
            >
              <CardContent className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-muted">
                    {brandSlug ? (
                      <ToolIcon name={null} slug={brandSlug} className="size-6" />
                    ) : (
                      <Icon className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <Badge variant="secondary" className="text-[11px]">
                    {template.category}
                  </Badge>
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold">{template.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {template.description}
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {template.tools.slice(0, 4).map((toolName) => {
                      const tool = Array.from(toolBySlug.values()).find(
                        (entry) => entry.name === toolName,
                      );
                      return (
                        <div
                          key={toolName}
                          className="flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground"
                        >
                          {tool && (
                            <ToolIcon
                              name={tool.icon}
                              slug={tool.slug}
                              color={tool.color}
                              className="size-3"
                            />
                          )}
                          {toolName}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between border-t border-border/60 pt-3">
                    <span className="text-[11px] text-muted-foreground">
                      {template.schedule}
                    </span>
                    <Button size="sm" className="h-8 gap-1.5 text-xs" asChild>
                      <Link
                        href={`/dashboard/agents?tab=create&prompt=${encodeURIComponent(template.prompt)}`}
                      >
                        Use template
                        <ArrowRight className="size-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        </div>
      )}
    </div>
  );
}
