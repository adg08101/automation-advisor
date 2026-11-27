import type { AutomationEvaluation } from "../types.js";

function clamp0to10(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(10, value));
}

export function calculateFinalScore(evaluation: AutomationEvaluation): number {
  const numerator =
    clamp0to10(evaluation.automationFeasibility) +
    clamp0to10(evaluation.businessValue) +
    clamp0to10(evaluation.repeatability) +
    clamp0to10(evaluation.locatorStability) +
    clamp0to10(evaluation.roi) +
    (10 - clamp0to10(evaluation.dataComplexity)) +
    (10 - clamp0to10(evaluation.maintenanceRisk));

  return Math.round((numerator / 70) * 100);
}

export function recommendationForScore(score: number): string {
  if (score <= 39) {
    return "Do Not Automate";
  }
  if (score <= 69) {
    return "Needs Review";
  }
  if (score <= 84) {
    return "Good Candidate";
  }
  return "Automate Soon";
}
