import { Router, type Response } from "express";
import { z } from "zod";
import {
  createCaseSchema,
  generationInputSchema,
  scoreInputSchema,
} from "../schemas/apiSchemas.js";
import type { Services } from "../services/serviceFactory.js";
import {
  calculateFinalScore,
  recommendationForScore,
} from "../services/score.js";
import {
  deriveEnvironmentMetadata,
  extractCaseContent,
} from "../services/testrailDomain.js";
import { HttpError } from "../utils/httpError.js";
import { sanitizeForAi } from "../utils/sanitize.js";
import type {
  TestRailCaseDetail,
  TestRailCaseSummary,
  TestRailProject,
  TestRailSection,
  TestRailSuite,
} from "../types.js";

function parseId(raw: string, name: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `Invalid ${name}.`);
  }
  return parsed;
}

export function createApiRouter(services: Services): Router {
  const router = Router();

  router.get("/projects", async (_req, res, next) => {
    try {
      const response = await services.testrail.get<
        { projects: TestRailProject[] } | TestRailProject[]
      >("get_projects");
      const projects = Array.isArray(response) ? response : response.projects;
      res.json(projects.filter((project) => !project.is_completed));
    } catch (error) {
      next(error);
    }
  });

  router.get("/projects/:projectId/suites", async (req, res, next) => {
    try {
      const projectId = parseId(req.params.projectId, "project ID");
      const response = await services.testrail.get<
        { suites: TestRailSuite[] } | TestRailSuite[]
      >(`get_suites/${projectId}`);
      const suites = Array.isArray(response) ? response : response.suites;
      res.json(suites);
    } catch (error) {
      next(error);
    }
  });

  router.get("/projects/:projectId/templates", async (req, res, next) => {
    try {
      const projectId = parseId(req.params.projectId, "project ID");
      const templates = await services.testrail.get<
        Array<{ id: number; name: string }>
      >(`get_templates/${projectId}`);
      res.json(templates);
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/projects/:projectId/templates/:templateId/environment-metadata",
    async (req, res, next) => {
      try {
        const projectId = parseId(req.params.projectId, "project ID");
        const templateId = parseId(req.params.templateId, "template ID");
        const fields = await services.testrail.get<unknown>("get_case_fields");
        const metadata = deriveEnvironmentMetadata(
          fields,
          projectId,
          templateId,
        );
        res.json(metadata);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/projects/:projectId/suites/:suiteId/tree",
    async (req, res, next) => {
      try {
        const projectId = parseId(req.params.projectId, "project ID");
        const suiteId = parseId(req.params.suiteId, "suite ID");
        const [sections, cases] = await Promise.all([
          services.testrail.getPaginated<TestRailSection>(
            `get_sections/${projectId}&suite_id=${suiteId}`,
            "sections",
          ),
          services.testrail.getPaginated<TestRailCaseSummary>(
            `get_cases/${projectId}&suite_id=${suiteId}`,
            "cases",
          ),
        ]);

        const casesBySection = cases.reduce<
          Record<number, TestRailCaseSummary[]>
        >((acc, item) => {
          if (!acc[item.section_id]) {
            acc[item.section_id] = [];
          }
          acc[item.section_id].push(item);
          return acc;
        }, {});

        res.json({
          sections,
          casesBySection,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post("/score", async (req, res, next) => {
    try {
      const input = scoreInputSchema.parse(req.body);
      console.log(`Scoring case ${input.caseId}...`);

      const testCase = await services.testrail.get<TestRailCaseDetail>(
        `get_case/${input.caseId}`,
      );
      console.log(`Retrieved case: ${testCase.title}`);

      const extracted = extractCaseContent(testCase);
      console.log(
        `Extracted case content with ${extracted.steps.length} steps`,
      );

      const sanitized = sanitizeForAi(JSON.stringify(extracted));
      console.log(`Sanitized content length: ${sanitized.length}`);

      const evaluation = await services.openai.evaluateCase(sanitized);
      console.log("Received evaluation from OpenAI");

      const finalScore = calculateFinalScore(evaluation);
      const recommendation = recommendationForScore(finalScore);

      res.json({
        caseId: input.caseId,
        caseTitle: extracted.title,
        evaluation,
        finalScore,
        recommendation,
        note: "AI output is advisory. Review before making decisions.",
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/generate-from-code", async (req, res, next) => {
    try {
      const input = generationInputSchema.parse(req.body);
      const sanitized = sanitizeForAi(input.code);
      const generated = await services.openai.generateFromCode(sanitized);
      if (!generated.isPlausible) {
        throw new HttpError(
          422,
          generated.rejectionReason ??
            "The provided code appears incomplete or implausible.",
        );
      }
      if (
        !generated.title ||
        !generated.steps ||
        generated.steps.length === 0
      ) {
        throw new HttpError(502, "Model response was missing title or steps.");
      }
      const normalizedSteps = generated.steps
        .map((step) => ({
          action: step.action.trim(),
          expectedResult: step.expectedResult.trim(),
          inferredOutcome: step.inferredOutcome,
        }))
        .filter((step) => step.action && step.expectedResult);

      if (normalizedSteps.length === 0) {
        throw new HttpError(
          502,
          "Model response did not include valid action/expected-result pairs.",
        );
      }

      res.json({
        title: generated.title.trim(),
        steps: normalizedSteps,
        caveats: generated.caveats,
        note: "AI assessment only. It does not compile or execute code.",
      });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/projects/:projectId/suites/:suiteId/sections/:sectionId/cases",
    async (req, res, next) => {
      try {
        const projectId = parseId(req.params.projectId, "project ID");
        const suiteId = parseId(req.params.suiteId, "suite ID");
        const sectionId = parseId(req.params.sectionId, "section ID");
        const input = createCaseSchema.parse(req.body);

        const [templates, sections, fields] = await Promise.all([
          services.testrail.get<Array<{ id: number; name: string }>>(
            `get_templates/${projectId}`,
          ),
          services.testrail.getPaginated<TestRailSection>(
            `get_sections/${projectId}&suite_id=${suiteId}`,
            "sections",
          ),
          services.testrail.get<unknown>("get_case_fields"),
        ]);

        if (!templates.some((template) => template.id === input.templateId)) {
          throw new HttpError(
            422,
            "Selected template is not available in this project.",
          );
        }
        if (
          !sections.some(
            (section) =>
              section.id === sectionId && section.suite_id === suiteId,
          )
        ) {
          throw new HttpError(
            422,
            "Selected section does not belong to the chosen suite.",
          );
        }

        const envMetadata = deriveEnvironmentMetadata(
          fields,
          projectId,
          input.templateId,
        );
        const selectedEnvironmentIds = input.environmentIds ?? [];

        if (envMetadata.applies) {
          const validIds = new Set(
            envMetadata.options.map((option) => option.id),
          );
          const hasInvalid = selectedEnvironmentIds.some(
            (id) => !validIds.has(id),
          );
          if (hasInvalid) {
            throw new HttpError(
              422,
              "One or more selected environments are invalid for this template.",
            );
          }
          if (envMetadata.required && selectedEnvironmentIds.length === 0) {
            throw new HttpError(
              422,
              "At least one environment must be selected for this template.",
            );
          }
        }

        const payload: Record<string, unknown> = {
          title: input.title,
          template_id: input.templateId,
          custom_preconds: input.preconditions ?? "",
          custom_steps_separated: input.steps.map((step) => ({
            content: step.action,
            expected: step.expectedResult,
          })),
        };

        if (envMetadata.applies && selectedEnvironmentIds.length > 0) {
          payload.custom_test_env = selectedEnvironmentIds;
        }

        const created = await services.testrail.post<{
          id: number;
          title: string;
        }>(`add_case/${sectionId}`, payload);
        res.status(201).json({
          case: {
            id: created.id,
            title: created.title,
            section_id: sectionId,
          },
          note: "Case was created in TestRail.",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.use((error: unknown, _req: unknown, res: Response, _next: unknown) => {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request payload.",
        details: error.issues.map((issue) => issue.message),
      });
    }
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.publicMessage });
    }
    return res.status(500).json({ error: "Unexpected server error." });
  });

  return router;
}
