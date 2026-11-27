import { describe, expect, test } from "vitest";
import {
  deriveEnvironmentMetadata,
  extractCaseContent,
} from "../src/services/testrailDomain.js";

describe("extractCaseContent", () => {
  test("prefers separated steps and falls back otherwise", () => {
    const withSeparated = extractCaseContent({
      id: 1,
      title: "Case",
      custom_steps_separated: [{ content: "click", expected: "opens" }],
    });
    expect(withSeparated.steps[0].action).toBe("click");

    const legacy = extractCaseContent({
      id: 2,
      title: "Case2",
      custom_steps: "A\nB",
      custom_expected: "X\nY",
    });
    expect(legacy.steps).toHaveLength(2);
    expect(legacy.steps[1].expected).toBe("Y");
  });
});

describe("deriveEnvironmentMetadata", () => {
  test("defaults to all options selected", () => {
    const fields = [
      {
        system_name: "custom_test_env",
        type_id: 12,
        configs: [
          {
            context: { is_global: false, project_ids: [10] },
            options: {
              is_required: true,
              template_ids: [4],
              items: "1,Chrome\n2,Firefox",
            },
          },
        ],
      },
    ];
    const metadata = deriveEnvironmentMetadata(fields, 10, 4);
    expect(metadata.applies).toBe(true);
    expect(metadata.required).toBe(true);
    expect(metadata.defaultSelectedIds).toEqual([1, 2]);
  });
});
