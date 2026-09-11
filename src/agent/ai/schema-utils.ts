import { z } from "zod";

/**
 * Zod → JSON Schema (draft 2020-12 via Zod 4's native converter) with a light
 * sanitizer for LLM structured-output endpoints that reject meta keys.
 */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io: "output",
  }) as Record<string, unknown>;
  return sanitize(json);
}

/** Accepts either a Zod schema or an already-JSON Schema parameters object. */
export function parametersToJsonSchema(
  parameters: z.ZodType | Record<string, unknown>,
): Record<string, unknown> {
  if (isZodSchema(parameters)) return zodToJsonSchema(parameters);
  return parameters as Record<string, unknown>;
}

function isZodSchema(value: unknown): value is z.ZodType {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { safeParse?: unknown }).safeParse === "function"
  );
}

/**
 * OpenAI strict structured outputs require every object property to be listed
 * in `required` and `additionalProperties: false`.
 */
export function toStrictJsonSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
  return enforceStrict(clone);
}

function enforceStrict(node: unknown): Record<string, unknown> {
  if (Array.isArray(node)) {
    return node.map((item) => enforceStrict(item)) as unknown as Record<
      string,
      unknown
    >;
  }
  if (!node || typeof node !== "object") return node as Record<string, unknown>;
  const source = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === "anyOf") {
      out.anyOf = (value as unknown[]).map((item) => enforceStrict(item));
      continue;
    }
    out[key] = enforceStrict(value);
  }
  if (out.type === "object" && out.properties && typeof out.properties === "object") {
    const properties = out.properties as Record<string, unknown>;
    out.required = Object.keys(properties);
    out.additionalProperties = false;
  }
  return out;
}

function sanitize(node: unknown): Record<string, unknown> {
  if (Array.isArray(node)) {
    return node.map((item) => sanitize(item)) as unknown as Record<string, unknown>;
  }
  if (!node || typeof node !== "object") return node as Record<string, unknown>;
  const source = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === "$schema" || key === "$id") continue;
    out[key] = sanitize(value);
  }
  return out;
}

/**
 * Gemini's Schema is an OpenAPI 3.03 subset. Modern `@google/genai` accepts raw
 * JSON Schema for `responseSchema` / `parametersJsonSchema`, so we only need to
 * convert nullable unions (`anyOf: [X, null]`) into `nullable: true`.
 */
export function toGeminiCompatibleSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
  return convertNullables(clone);
}

function convertNullables(node: unknown): Record<string, unknown> {
  if (Array.isArray(node)) {
    return node.map((item) => convertNullables(item)) as unknown as Record<
      string,
      unknown
    >;
  }
  if (!node || typeof node !== "object") return node as Record<string, unknown>;
  const source = node as Record<string, unknown>;

  const anyOf = source.anyOf;
  if (Array.isArray(anyOf) && anyOf.length === 2) {
    const nullIndex = anyOf.findIndex(
      (item) =>
        item &&
        typeof item === "object" &&
        (item as Record<string, unknown>).type === "null",
    );
    if (nullIndex !== -1) {
      const other = anyOf[nullIndex === 0 ? 1 : 0] as Record<string, unknown>;
      const rest = { ...source };
      delete rest.anyOf;
      return convertNullables({ ...rest, ...other, nullable: true });
    }
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    out[key] = convertNullables(value);
  }
  return out;
}
