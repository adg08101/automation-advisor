import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import App from "./App";

vi.mock("./api", () => ({
  getConnectionInfo: vi.fn().mockResolvedValue({
    server: { status: "online", port: 4000 },
    testrail: { baseUrl: "https://example.testrail.io", host: "example.testrail.io" },
    openai: { model: "gpt-4.1-mini" },
    note: "Credentials are server-side only and are never sent to the client."
  }),
  getProjects: vi.fn().mockResolvedValue([{ id: 1, name: "Proj" }]),
  getSuites: vi.fn().mockResolvedValue([{ id: 2, name: "Suite", project_id: 1 }]),
  getTemplates: vi.fn().mockResolvedValue([{ id: 4, name: "Test Case (Steps)" }]),
  getTree: vi.fn().mockResolvedValue({ sections: [{ id: 9, name: "Section", parent_id: null, depth: 0, suite_id: 2 }], casesBySection: { 9: [] } }),
  getEnvironmentMetadata: vi.fn().mockResolvedValue({ applies: false, required: false, options: [], defaultSelectedIds: [] }),
  scoreCase: vi.fn().mockResolvedValue({
    caseId: 123,
    caseTitle: "Sample",
    evaluation: {
      automationFeasibility: 8,
      businessValue: 8,
      descriptionQuality: 8,
      repeatability: 8,
      locatorStability: 8,
      dataComplexity: 2,
      maintenanceRisk: 2,
      roi: 8,
      estimatedEffort: "Medium",
      risks: ["Risk"],
      reasoning: "Reason",
      suggestedPlaywrightTestName: "name",
      suggestedPageObjects: ["Page"]
    },
    finalScore: 86,
    recommendation: "Automate Soon",
    note: "note"
  }),
  generateFromCode: vi.fn().mockResolvedValue({
    title: "Generated title",
    steps: [{ action: "Act", expectedResult: "Expect", inferredOutcome: true }],
    caveats: [],
    note: "note"
  }),
  createCase: vi.fn().mockResolvedValue({ case: { id: 44, title: "x", section_id: 9 }, note: "ok" })
}));

describe("App", () => {
  test("renders scorer and submits case id", async () => {
    render(<App />);
    expect(await screen.findByText(/connection info/i)).toBeTruthy();
    const input = screen.getByLabelText(/testrail case id/i);
    fireEvent.change(input, { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /score case/i }));
    expect(await screen.findByText(/score:/i)).toBeTruthy();
  });
});
