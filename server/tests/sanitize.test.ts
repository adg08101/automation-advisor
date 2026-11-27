import { describe, expect, test } from "vitest";
import { sanitizeForAi } from "../src/utils/sanitize.js";

describe("sanitizeForAi", () => {
  test("redacts common sensitive values", () => {
    const input =
      "Contact qa@example.com at +1 555-100-2000 URL https://internal.local token=abc123xyz";
    const output = sanitizeForAi(input);
    expect(output).toContain("[REDACTED_EMAIL]");
    expect(output).toContain("[REDACTED_PHONE]");
    expect(output).toContain("[REDACTED_URL]");
    expect(output).toContain("token=[REDACTED_SECRET]");
  });
});
