import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  createCase,
  generateFromCode,
  getConnectionInfo,
  getEnvironmentMetadata,
  getProjects,
  getSuites,
  getTemplates,
  getTree,
  scoreCase
} from "./api";
import type {
  ConnectionInfoResponse,
  EnvironmentMetadata,
  Project,
  ScoreResponse,
  Section,
  Suite,
  Template,
  TreeResponse
} from "./types";

type StepForm = { action: string; expectedResult: string };

function scoreBandMessage(score: number): string {
  if (score <= 39) return "Do Not Automate";
  if (score <= 69) return "Needs Review";
  if (score <= 84) return "Good Candidate";
  return "Automate Soon";
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const responseError = error.response?.data?.error;
    if (typeof responseError === "string" && responseError.trim().length > 0) {
      return responseError;
    }
  }
  return fallback;
}

function SectionTree({
  sections,
  casesBySection,
  selectedSectionId,
  onSelectSection,
  onCaseClick
}: {
  sections: Section[];
  casesBySection: TreeResponse["casesBySection"];
  selectedSectionId: number | null;
  onSelectSection: (id: number) => void;
  onCaseClick: (caseId: number) => void;
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const children = useMemo(() => {
    const map: Record<number, Section[]> = {};
    for (const section of sections) {
      const parent = section.parent_id ?? 0;
      map[parent] ??= [];
      map[parent].push(section);
    }
    return map;
  }, [sections]);

  const renderNode = (parentId: number, level: number) => {
    const nodes = children[parentId] ?? [];
    return nodes.flatMap((section) => {
      const isOpen = expanded[section.id] ?? true;
      const sectionCases = casesBySection[section.id] ?? [];
      const row = (
        <div key={`section-${section.id}`} className="space-y-2">
          <div className="flex items-center gap-2" style={{ marginLeft: `${level * 14}px` }}>
            <button
              type="button"
              aria-label={`Toggle ${section.name}`}
              onClick={() => setExpanded((prev) => ({ ...prev, [section.id]: !isOpen }))}
              className="bg-slate-700 text-cyan-300"
            >
              {isOpen ? "−" : "+"}
            </button>
            <button
              type="button"
              onClick={() => onSelectSection(section.id)}
              className={`flex-1 text-left ${selectedSectionId === section.id ? "bg-cyan-600 text-slate-900" : "bg-slate-800 text-slate-100"}`}
            >
              {section.name}
            </button>
          </div>
          {isOpen && (
            <div className="space-y-1">
              {sectionCases.length > 0 ? (
                sectionCases.map((testCase) => (
                  <button
                    type="button"
                    key={testCase.id}
                    onClick={() => onCaseClick(testCase.id)}
                    className="ml-10 block w-[calc(100%-2.5rem)] rounded-md border border-slate-700 bg-slate-900 p-2 text-left text-sm hover:border-cyan-400"
                  >
                    #{testCase.id} {testCase.title}
                  </button>
                ))
              ) : (
                <p className="ml-10 text-sm text-slate-400">No cases in this section yet.</p>
              )}
            </div>
          )}
          {isOpen && renderNode(section.id, level + 1)}
        </div>
      );
      return [row];
    });
  };

  return <div className="space-y-3">{renderNode(0, 0)}</div>;
}

export default function App() {
  const [tab, setTab] = useState<"scorer" | "projects">("scorer");
  const [caseIdInput, setCaseIdInput] = useState("");
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState("");
  const [scoreResult, setScoreResult] = useState<ScoreResponse | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfoResponse | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [connectionError, setConnectionError] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tree, setTree] = useState<TreeResponse | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedSuiteId, setSelectedSuiteId] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingSuites, setLoadingSuites] = useState(false);
  const [loadingTree, setLoadingTree] = useState(false);
  const [projectsError, setProjectsError] = useState("");

  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [preconditions, setPreconditions] = useState("");
  const [steps, setSteps] = useState<StepForm[]>([{ action: "", expectedResult: "" }]);
  const [environments, setEnvironments] = useState<EnvironmentMetadata | null>(null);
  const [selectedEnvironmentIds, setSelectedEnvironmentIds] = useState<number[]>([]);
  const [code, setCode] = useState("");
  const [generationState, setGenerationState] = useState({ loading: false, message: "", error: "" });
  const [submitState, setSubmitState] = useState({ loading: false, message: "", error: "" });

  useEffect(() => {
    const controller = new AbortController();
    setConnectionLoading(true);
    setConnectionError("");
    getConnectionInfo(controller.signal)
      .then(setConnectionInfo)
      .catch((error) => {
        if (!axios.isCancel(error)) {
          setConnectionError("Unable to load connection info.");
        }
      })
      .finally(() => setConnectionLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingProjects(true);
    setProjectsError("");
    getProjects(controller.signal)
      .then(setProjects)
      .catch((error) => {
        if (!axios.isCancel(error)) {
          setProjectsError(getApiErrorMessage(error, "Could not load projects."));
        }
      })
      .finally(() => setLoadingProjects(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    const controller = new AbortController();
    setLoadingSuites(true);
    setTree(null);
    setSelectedSuiteId(null);
    setSelectedSectionId(null);
    Promise.all([getSuites(selectedProjectId, controller.signal), getTemplates(selectedProjectId, controller.signal)])
      .then(([suitesData, templatesData]) => {
        setSuites(suitesData);
        setTemplates(templatesData);
        const preferred = templatesData.find((template) => template.name === "Test Case (Steps)");
        setTemplateId(preferred?.id ?? null);
      })
      .catch((error) => {
        if (!axios.isCancel(error)) {
          setProjectsError(getApiErrorMessage(error, "Failed to load suites/templates for selected project."));
        }
      })
      .finally(() => setLoadingSuites(false));
    return () => controller.abort();
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !selectedSuiteId) return;
    const controller = new AbortController();
    setLoadingTree(true);
    setSelectedSectionId(null);
    getTree(selectedProjectId, selectedSuiteId, controller.signal)
      .then(setTree)
      .catch((error) => {
        if (!axios.isCancel(error)) {
          setProjectsError(getApiErrorMessage(error, "Failed to load sections and cases."));
        }
      })
      .finally(() => setLoadingTree(false));
    return () => controller.abort();
  }, [selectedProjectId, selectedSuiteId]);

  useEffect(() => {
    if (!selectedProjectId || !templateId) {
      setEnvironments(null);
      setSelectedEnvironmentIds([]);
      return;
    }
    const controller = new AbortController();
    getEnvironmentMetadata(selectedProjectId, templateId, controller.signal)
      .then((metadata) => {
        setEnvironments(metadata);
        setSelectedEnvironmentIds(metadata.defaultSelectedIds);
      })
      .catch((error) => {
        if (!axios.isCancel(error)) {
          setEnvironments(null);
        }
      });
    return () => controller.abort();
  }, [selectedProjectId, templateId]);

  async function handleScore() {
    const caseId = Number(caseIdInput);
    if (!Number.isInteger(caseId) || caseId <= 0) {
      setScoreError("Enter a positive numeric case ID.");
      return;
    }
    setScoreError("");
    setScoreLoading(true);
    try {
      const data = await scoreCase(caseId);
      setScoreResult(data);
    } catch {
      setScoreError("Unable to evaluate case. Please verify the case ID and configuration.");
    } finally {
      setScoreLoading(false);
    }
  }

  function updateStep(index: number, patch: Partial<StepForm>) {
    setSteps((prev) => prev.map((step, idx) => (idx === index ? { ...step, ...patch } : step)));
  }

  function removeStep(index: number) {
    setSteps((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));
  }

  async function handleGenerate() {
    if (!code.trim()) {
      setGenerationState({ loading: false, message: "", error: "Paste test code before generating." });
      return;
    }
    setGenerationState({ loading: true, message: "Generating title and steps from code...", error: "" });
    try {
      const response = await generateFromCode(code);
      setTitle(response.title);
      setSteps(response.steps.map((step) => ({ action: step.action, expectedResult: step.expectedResult })));
      setGenerationState({
        loading: false,
        message: "Generated content replaced title and steps. Review and edit before submission.",
        error: ""
      });
    } catch {
      setGenerationState({ loading: false, message: "", error: "Generation failed. Existing form values were kept." });
    }
  }

  async function handleCreateCase() {
    if (!selectedProjectId || !selectedSuiteId || !selectedSectionId) {
      setSubmitState({ loading: false, message: "", error: "Choose project, suite, and destination section." });
      return;
    }
    if (!title.trim()) {
      setSubmitState({ loading: false, message: "", error: "Title is required." });
      return;
    }
    if (!templateId) {
      setSubmitState({ loading: false, message: "", error: "Select a template." });
      return;
    }
    if (steps.some((step) => !step.action.trim() || !step.expectedResult.trim())) {
      setSubmitState({ loading: false, message: "", error: "Every step must include action and expected result." });
      return;
    }
    if (environments?.applies && environments.required && selectedEnvironmentIds.length === 0) {
      setSubmitState({ loading: false, message: "", error: "At least one environment is required." });
      return;
    }

    setSubmitState({ loading: true, message: "Submitting case to TestRail...", error: "" });
    try {
      const result = await createCase(selectedProjectId, selectedSuiteId, selectedSectionId, {
        title: title.trim(),
        templateId,
        preconditions,
        environmentIds: environments?.applies ? selectedEnvironmentIds : undefined,
        steps
      });
      setSubmitState({ loading: false, message: `Case #${result.case.id} created successfully.`, error: "" });
      setTree((prev) => {
        if (!prev) return prev;
        const nextMap = { ...prev.casesBySection };
        nextMap[selectedSectionId] = [...(nextMap[selectedSectionId] ?? []), result.case];
        return { ...prev, casesBySection: nextMap };
      });
    } catch {
      setSubmitState({
        loading: false,
        message: "",
        error: "Creation failed or uncertain. Check TestRail before retrying to avoid duplicates."
      });
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl p-4 md:p-8">
      <header className="mb-6 rounded-xl border border-slate-700 bg-panel p-4">
        <h1 className="text-2xl font-semibold text-cyan-300">AutoScore Advisor</h1>
        <p className="mt-1 text-sm text-slate-300">
          AI guidance only. Review all generated or scored output before creating TestRail cases.
        </p>
        <div className="mt-3 rounded-md border border-slate-700 bg-slate-900 p-3" aria-live="polite">
          <p className="text-sm font-medium text-cyan-200">Connection Info</p>
          {connectionLoading && <p className="mt-1 text-xs text-slate-400">Loading connection info...</p>}
          {connectionError && <p className="mt-1 text-xs text-red-300">{connectionError}</p>}
          {connectionInfo && (
            <div className="mt-2 grid gap-1 text-xs text-slate-300 md:grid-cols-2">
              <p>
                <span className="text-slate-400">Server:</span> {connectionInfo.server.status} on port {connectionInfo.server.port}
              </p>
              <p>
                <span className="text-slate-400">OpenAI model:</span> {connectionInfo.openai.model}
              </p>
              <p className="md:col-span-2">
                <span className="text-slate-400">TestRail host:</span> {connectionInfo.testrail.host}
              </p>
              <p className="md:col-span-2 text-slate-400">{connectionInfo.note}</p>
            </div>
          )}
        </div>
      </header>

      <nav className="mb-4 flex gap-2" aria-label="Main navigation tabs">
        <button
          type="button"
          className={tab === "scorer" ? "bg-cyan-400 text-slate-900" : "bg-slate-700 text-slate-100"}
          onClick={() => setTab("scorer")}
        >
          Scorer
        </button>
        <button
          type="button"
          className={tab === "projects" ? "bg-cyan-400 text-slate-900" : "bg-slate-700 text-slate-100"}
          onClick={() => setTab("projects")}
        >
          Projects
        </button>
      </nav>

      {tab === "scorer" && (
        <section className="space-y-4 rounded-xl border border-slate-700 bg-panel p-4">
          <h2 className="text-lg font-semibold">Evaluate Automation Suitability</h2>
          <label className="block text-sm" htmlFor="caseId">
            TestRail Case ID
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="caseId"
              inputMode="numeric"
              value={caseIdInput}
              onChange={(event) => setCaseIdInput(event.target.value)}
              aria-describedby="caseIdHelp"
            />
            <button type="button" disabled={scoreLoading} onClick={handleScore} className="bg-cyan-500 text-slate-900 disabled:opacity-60">
              {scoreLoading ? "Scoring..." : "Score Case"}
            </button>
          </div>
          <p id="caseIdHelp" className="text-xs text-slate-400">
            Only positive numeric IDs are accepted.
          </p>
          {scoreError && <p className="text-sm text-red-300">{scoreError}</p>}
          {scoreResult && (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
              <h3 className="font-semibold text-cyan-300">
                #{scoreResult.caseId} {scoreResult.caseTitle}
              </h3>
              <p className="mt-2 text-lg">
                Score: <span className="font-semibold text-cyan-300">{scoreResult.finalScore}</span> / 100 ({scoreBandMessage(scoreResult.finalScore)})
              </p>
              <p className="text-sm text-slate-300">Recommendation: {scoreResult.recommendation}</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {(
                  [
                    ["automationFeasibility", scoreResult.evaluation.automationFeasibility],
                    ["businessValue", scoreResult.evaluation.businessValue],
                    ["descriptionQuality", scoreResult.evaluation.descriptionQuality],
                    ["repeatability", scoreResult.evaluation.repeatability],
                    ["locatorStability", scoreResult.evaluation.locatorStability],
                    ["dataComplexity", scoreResult.evaluation.dataComplexity],
                    ["maintenanceRisk", scoreResult.evaluation.maintenanceRisk],
                    ["roi", scoreResult.evaluation.roi]
                  ] as Array<[string, number]>
                ).map(([key, value]) => (
                  <p key={key} className="text-sm">
                    <span className="text-slate-400">{key}:</span> {String(value)}
                  </p>
                ))}
              </div>
              <p className="mt-3 text-sm text-slate-300">Reasoning: {scoreResult.evaluation.reasoning}</p>
              <p className="mt-1 text-sm text-slate-300">Estimated effort: {scoreResult.evaluation.estimatedEffort}</p>
              <p className="mt-1 text-sm text-slate-300">Risks: {scoreResult.evaluation.risks.join(", ")}</p>
              <p className="mt-1 text-sm text-slate-300">Suggested test: {scoreResult.evaluation.suggestedPlaywrightTestName}</p>
              <p className="mt-1 text-sm text-slate-300">Page objects: {scoreResult.evaluation.suggestedPageObjects.join(", ")}</p>
              <p className="mt-2 text-xs text-slate-400">{scoreResult.note}</p>
            </div>
          )}
        </section>
      )}

      {tab === "projects" && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-slate-700 bg-panel p-4">
            <h2 className="text-lg font-semibold">TestRail Browsing</h2>
            {loadingProjects && <p className="text-sm text-slate-300">Loading projects...</p>}
            {projectsError && <p className="text-sm text-red-300">{projectsError}</p>}

            <label className="block text-sm" htmlFor="project">
              Project
            </label>
            <select
              id="project"
              value={selectedProjectId ?? ""}
              onChange={(event) => setSelectedProjectId(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>

            <label className="block text-sm" htmlFor="suite">
              Suite
            </label>
            <select
              id="suite"
              value={selectedSuiteId ?? ""}
              onChange={(event) => setSelectedSuiteId(event.target.value ? Number(event.target.value) : null)}
              disabled={!selectedProjectId || loadingSuites}
            >
              <option value="">Select suite</option>
              {suites.map((suite) => (
                <option key={suite.id} value={suite.id}>
                  {suite.name}
                </option>
              ))}
            </select>

            {loadingTree && <p className="text-sm text-slate-300">Loading sections and cases...</p>}
            {tree && tree.sections.length === 0 && <p className="text-sm text-slate-400">No sections found for this suite.</p>}
            {tree && tree.sections.length > 0 && (
              <SectionTree
                sections={tree.sections}
                casesBySection={tree.casesBySection}
                selectedSectionId={selectedSectionId}
                onSelectSection={setSelectedSectionId}
                onCaseClick={(caseId) => {
                  setCaseIdInput(String(caseId));
                  setTab("scorer");
                }}
              />
            )}
          </div>

          <div className="space-y-4 rounded-xl border border-slate-700 bg-panel p-4">
            <h2 className="text-lg font-semibold">Create Manual Case</h2>
            <p className="text-xs text-slate-400">
              Warning: Redaction is best effort and may alter context. Do not paste secrets or sensitive data. OpenAI usage may incur costs.
            </p>
            <p className="text-xs text-cyan-200">
              Generate action replaces current title and all steps only; template, preconditions, and environments stay unchanged.
            </p>

            <label htmlFor="title" className="block text-sm">
              Title (required, max 250)
            </label>
            <input id="title" maxLength={250} value={title} onChange={(event) => setTitle(event.target.value)} />

            <label htmlFor="template" className="block text-sm">
              Template
            </label>
            <select
              id="template"
              value={templateId ?? ""}
              onChange={(event) => setTemplateId(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">Select template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            {!templates.some((template) => template.name === "Test Case (Steps)") && (
              <p className="text-xs text-slate-400">Choose a template that supports separated steps.</p>
            )}

            <label htmlFor="preconditions" className="block text-sm">
              Preconditions
            </label>
            <textarea id="preconditions" rows={3} value={preconditions} onChange={(event) => setPreconditions(event.target.value)} />

            {environments?.applies && (
              <fieldset className="rounded-md border border-slate-700 p-3">
                <legend className="text-sm">Environments {environments.required ? "(required)" : "(optional)"}</legend>
                <div className="mt-2 space-y-1">
                  {environments.options.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedEnvironmentIds.includes(option.id)}
                        onChange={(event) => {
                          setSelectedEnvironmentIds((prev) => {
                            if (event.target.checked) {
                              return [...new Set([...prev, option.id])];
                            }
                            return prev.filter((id) => id !== option.id);
                          });
                        }}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {environments && !environments.applies && <p className="text-xs text-slate-400">{environments.reason}</p>}

            <label htmlFor="codeInput" className="block text-sm">
              Optional test code (max 30,000 chars)
            </label>
            <textarea
              id="codeInput"
              rows={6}
              maxLength={30000}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Paste a full test or method declaration with body. Code is never executed."
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generationState.loading || submitState.loading}
              className="bg-cyan-500 text-slate-900 disabled:opacity-60"
            >
              {generationState.loading ? "Generating..." : "Generate Title & Steps"}
            </button>
            {generationState.message && <p className="text-xs text-cyan-200">{generationState.message}</p>}
            {generationState.error && <p className="text-xs text-red-300">{generationState.error}</p>}

            <div className="space-y-2">
              <p className="text-sm font-medium">Steps (ordered)</p>
              {steps.map((step, index) => (
                <div key={`step-${index}`} className="rounded-md border border-slate-700 p-3">
                  <p className="mb-2 text-xs text-slate-400">Step {index + 1}</p>
                  <label className="text-xs">Action</label>
                  <textarea rows={2} value={step.action} onChange={(event) => updateStep(index, { action: event.target.value })} />
                  <label className="mt-2 block text-xs">Expected result</label>
                  <textarea
                    rows={2}
                    value={step.expectedResult}
                    onChange={(event) => updateStep(index, { expectedResult: event.target.value })}
                  />
                  <button type="button" onClick={() => removeStep(index)} className="mt-2 bg-slate-700 text-slate-100">
                    Remove Step
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="bg-slate-700 text-slate-100"
                onClick={() => setSteps((prev) => [...prev, { action: "", expectedResult: "" }])}
              >
                Add Step
              </button>
            </div>

            <button
              type="button"
              onClick={handleCreateCase}
              disabled={submitState.loading || generationState.loading}
              className="bg-cyan-500 text-slate-900 disabled:opacity-60"
            >
              {submitState.loading ? "Submitting..." : "Create Case in Selected Section"}
            </button>
            {submitState.message && <p className="text-sm text-cyan-200">{submitState.message}</p>}
            {submitState.error && <p className="text-sm text-red-300">{submitState.error}</p>}
          </div>
        </section>
      )}
    </main>
  );
}
