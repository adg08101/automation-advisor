import { describe, expect, test } from "vitest";
import {
  calculateFinalScore,
  recommendationForScore,
} from "../src/services/score.js";

describe("score calculation", () => {
  test("calculates rounded normalized score", () => {
    const score = calculateFinalScore({
      automationFeasibility: 8,
      businessValue: 7,
      descriptionQuality: 4,
      repeatability: 9,
      locatorStability: 8,
      dataComplexity: 3,
      maintenanceRisk: 4,
      roi: 8,
      estimatedEffort: "Medium",
      risks: ["Dynamic selectors"],
      reasoning: "Stable flow",
      suggestedPlaywrightTestName: "checkout-smoke",
      suggestedPageObjects: ["CartPage"],
    });

    expect(score).toBe(76);
  });

  test("matches recommendation boundaries", () => {
    expect(recommendationForScore(39)).toBe("Do Not Automate");
    expect(recommendationForScore(40)).toBe("Needs Review");
    expect(recommendationForScore(70)).toBe("Good Candidate");
    expect(recommendationForScore(85)).toBe("Automate Soon");
  });
});
