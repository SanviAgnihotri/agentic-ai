"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, MessageCircleQuestion, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { ClarificationQuestion } from "@/agent/config/response-schema";
import { cn } from "@/lib/utils";

export function ClarificationWizard({
  questions,
  onComplete,
  onBack,
  submitting,
}: {
  questions: ClarificationQuestion[];
  onComplete: (answers: Record<string, string>) => void;
  onBack: () => void;
  submitting: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});

  const question = questions[index];
  const selected = useMemo(
    () => answers[question?.id ?? ""] ?? [],
    [answers, question?.id],
  );

  const toggleOption = (option: string) => {
    if (!question) return;
    setAnswers((previous) => {
      const current = previous[question.id] ?? [];
      if (question.type === "multi_select") {
        return {
          ...previous,
          [question.id]: current.includes(option)
            ? current.filter((value) => value !== option)
            : [...current, option],
        };
      }
      return { ...previous, [question.id]: [option] };
    });
  };

  const setCustomValue = (value: string) => {
    if (!question) return;
    setCustom((previous) => ({ ...previous, [question.id]: value }));
    if (value.trim()) {
      setAnswers((previous) => ({ ...previous, [question.id]: [value.trim()] }));
    }
  };

  const canContinue = selected.length > 0 || question?.type === "text";

  const next = () => {
    if (!question) return;
    if (index < questions.length - 1) {
      setIndex((value) => value + 1);
      return;
    }
    const flattened: Record<string, string> = {};
    for (const item of questions) {
      const values = answers[item.id] ?? [];
      if (values.length > 0) flattened[item.id] = values.join(", ");
    }
    onComplete(flattened);
  };

  if (!question) return null;

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardContent className="space-y-6 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <MessageCircleQuestion className="size-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              The planner needs a little more detail
            </p>
            <p className="text-xs text-muted-foreground">
              Question {index + 1} of {questions.length}
            </p>
          </div>
          <Badge variant="outline" className="border-primary/25 text-primary">
            Clarification
          </Badge>
        </div>

        <Progress value={((index + 1) / questions.length) * 100} className="h-1.5" />

        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">{question.question}</h2>
          {question.type !== "text" && (
            <p className="text-sm text-muted-foreground">
              Choose the closest option
              {question.allowCustom ? ", or type your own below." : "."}
            </p>
          )}
        </div>

        <div className="space-y-2">
          {question.options?.map((option) => {
            const active = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggleOption(option)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left text-sm transition",
                  active
                    ? "border-primary/50 bg-primary/8 text-foreground"
                    : "border-border/70 bg-muted/20 hover:border-primary/30 hover:bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center border transition",
                    question.type === "multi_select" ? "rounded-md" : "rounded-full",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                >
                  {active && <Check className="size-3" />}
                </span>
                {option}
              </button>
            );
          })}
        </div>

        {(question.type === "text" || question.allowCustom) && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {question.type === "text" ? "Your answer" : "Or write your own"}
            </label>
            <Input
              value={custom[question.id] ?? ""}
              onChange={(event) => setCustomValue(event.target.value)}
              placeholder={question.customPlaceholder ?? "Type your answer…"}
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            className="gap-2"
            onClick={() => (index === 0 ? onBack() : setIndex((value) => value - 1))}
            disabled={submitting}
          >
            <ArrowLeft className="size-4" />
            {index === 0 ? "Start over" : "Back"}
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={next}
            disabled={!canContinue || submitting}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            {index === questions.length - 1 ? "Generate my agent" : "Continue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
