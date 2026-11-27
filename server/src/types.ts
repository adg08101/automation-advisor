export type TestRailProject = {
  id: number;
  name: string;
  is_completed: boolean;
};

export type TestRailSuite = {
  id: number;
  name: string;
  project_id: number;
};

export type TestRailSection = {
  id: number;
  name: string;
  parent_id: number | null;
  depth: number;
  suite_id: number;
};

export type TestRailCaseSummary = {
  id: number;
  title: string;
  section_id: number;
};

export type CaseStep = {
  content: string;
  expected: string;
};

export type TestRailCaseDetail = {
  id: number;
  title: string;
  priority_id?: number;
  type_id?: number;
  refs?: string;
  custom_preconds?: string;
  custom_steps?: string;
  custom_expected?: string;
  custom_steps_separated?: Array<{ content: string; expected: string }>;
  [key: string]: unknown;
};

export type AutomationEvaluation = {
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

export type GeneratedCaseFromCode = {
  title: string;
  steps: Array<{
    action: string;
    expectedResult: string;
    inferredOutcome: boolean;
  }>;
  caveats: string[];
};
