export type Project = { id: number; name: string; is_completed?: boolean };
export type Suite = { id: number; name: string; project_id: number };
export type Section = {
  id: number;
  name: string;
  parent_id: number | null;
  depth: number;
  suite_id: number;
};
export type CaseSummary = { id: number; title: string; section_id: number };
export type TreeResponse = {
  sections: Section[];
  casesBySection: Record<number, CaseSummary[]>;
};
export type Template = { id: number; name: string };
export type EnvironmentMetadata = {
  applies: boolean;
  required: boolean;
  options: Array<{ id: number; label: string }>;
  defaultSelectedIds: number[];
  reason?: string;
};

export type ScoreResponse = {
  caseId: number;
  caseTitle: string;
  evaluation: {
    automationFeasibility: number;
    businessValue: number;
    descriptionQuality: number;
    repeatability: number;
    locatorStability: number;
    dataComplexity: number;
    maintenanceRisk: number;
    roi: number;
    estimatedEffort: string;
    risks: string[];
    reasoning: string;
    suggestedPlaywrightTestName: string;
    suggestedPageObjects: string[];
  };
  finalScore: number;
  recommendation: string;
  note: string;
};

export type GenerateResponse = {
  title: string;
  steps: Array<{
    action: string;
    expectedResult: string;
    inferredOutcome: boolean;
  }>;
  caveats: string[];
  note: string;
};

export type ConnectionInfoResponse = {
  server: { status: "online"; port: number };
  testrail: { baseUrl: string; host: string };
  openai: { model: string };
  note: string;
};
