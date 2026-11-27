import { z } from "zod";

function normalizeTextList(input: unknown): string[] {
  if (Array.isArray(input)) {
    const list = input
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0);
    return list.length > 0 ? list : ["Review required."];
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) {
      return ["Review required."];
    }

    const split = trimmed
      .split(/\r?\n|;|\|/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    return split.length > 0 ? split : [trimmed];
  }

  if (typeof input === "number" || typeof input === "boolean") {
    return [String(input)];
  }

  if (input && typeof input === "object") {
    const values = Object.values(input as Record<string, unknown>)
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0);
    return values.length > 0 ? values : ["Review required."];
  }

  return ["Review required."];
}

function normalizeEffort(input: unknown): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }

  if (typeof input === "string") {
    const lowered = input.trim().toLowerCase();
    const numeric = Number(lowered);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
    if (lowered.includes("low")) return 3;
    if (lowered.includes("medium")) return 5;
    if (lowered.includes("high")) return 8;
  }

  return 5;
}

export const scoreInputSchema = z.object({
  caseId: z.number().int().positive(),
});

export const generationInputSchema = z.object({
  code: z
    .string()
    .min(20, "Provide a full test or method declaration and body.")
    .max(30000, "Code exceeds 30,000 character limit.")
    .refine(
      (value) =>
        /\b(test|it|describe|function|def|public|private|async)\b/.test(
          value,
        ) && /\{[\s\S]*\}/.test(value),
      {
        message: "Provide a complete method/test declaration with body.",
      },
    ),
});

export const createCaseSchema = z.object({
  title: z.string().min(1).max(250),
  templateId: z.number().int().positive(),
  preconditions: z.string().max(20000).optional(),
  environmentIds: z.array(z.number().int().positive()).optional(),
  steps: z
    .array(
      z.object({
        action: z.string().min(1),
        expectedResult: z.string().min(1),
      }),
    )
    .min(1),
});

export const evaluationOutputSchema = z.object({
  automationFeasibility: z.coerce.number().min(0).max(10),
  businessValue: z.coerce.number().min(0).max(10),
  descriptionQuality: z.coerce.number().min(0).max(10),
  repeatability: z.coerce.number().min(0).max(10),
  locatorStability: z.coerce.number().min(0).max(10),
  dataComplexity: z.coerce.number().min(0).max(10),
  maintenanceRisk: z.coerce.number().min(0).max(10),
  roi: z.coerce.number().min(0).max(10),
  estimatedEffort: z.preprocess(normalizeEffort, z.number().min(0).max(10)),
  risks: z.preprocess(normalizeTextList, z.array(z.string().min(1)).min(1)),
  reasoning: z.string().min(1),
  suggestedPlaywrightTestName: z.string().min(1),
  suggestedPageObjects: z.preprocess(
    normalizeTextList,
    z.array(z.string().min(1)).min(1),
  ),
});

export const generatedFromCodeSchema = z.object({
  isPlausible: z.boolean(),
  title: z.string().optional(),
  steps: z
    .array(
      z.object({
        action: z.string(),
        expectedResult: z.string(),
        inferredOutcome: z.boolean(),
      }),
    )
    .optional(),
  rejectionReason: z.string().optional(),
  caveats: z.array(z.string()).default([]),
});
