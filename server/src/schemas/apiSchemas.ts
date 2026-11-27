import { z } from "zod";

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
  automationFeasibility: z.number(),
  businessValue: z.number(),
  descriptionQuality: z.number(),
  repeatability: z.number(),
  locatorStability: z.number(),
  dataComplexity: z.number(),
  maintenanceRisk: z.number(),
  roi: z.number(),
  estimatedEffort: z.string().min(1),
  risks: z.array(z.string().min(1)).min(1),
  reasoning: z.string().min(1),
  suggestedPlaywrightTestName: z.string().min(1),
  suggestedPageObjects: z.array(z.string().min(1)).min(1),
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
