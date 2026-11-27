import { HttpError } from "../utils/httpError.js";
import type { TestRailCaseDetail } from "../types.js";

export type EnvironmentMetadata = {
  applies: boolean;
  required: boolean;
  options: Array<{ id: number; label: string }>;
  defaultSelectedIds: number[];
  reason?: string;
};

type CaseFieldConfig = {
  context: {
    is_global: boolean;
    project_ids?: number[];
  };
  options: {
    is_required?: boolean;
    items?: string;
    template_ids?: number[];
  };
};

type CaseField = {
  system_name: string;
  type_id: number;
  configs: CaseFieldConfig[];
};

export function extractCaseContent(input: TestRailCaseDetail): {
  title: string;
  preconditions: string;
  references: string;
  priority: string;
  type: string;
  steps: Array<{ action: string; expected: string }>;
  customFields: Record<string, unknown>;
} {
  const separated = Array.isArray(input.custom_steps_separated)
    ? input.custom_steps_separated
        .filter(
          (step) => (step.content ?? "").trim() || (step.expected ?? "").trim(),
        )
        .map((step) => ({
          action: String(step.content ?? ""),
          expected: String(step.expected ?? ""),
        }))
    : [];

  const legacyActions = String(input.custom_steps ?? "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  const legacyExpected = String(input.custom_expected ?? "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  const fallback = legacyActions.map((action, index) => ({
    action,
    expected: legacyExpected[index] ?? "Expected result to be verified.",
  }));
  const steps = separated.length > 0 ? separated : fallback;

  const customFields = Object.fromEntries(
    Object.entries(input).filter(
      ([key]) =>
        key.startsWith("custom_") &&
        !["custom_steps", "custom_expected", "custom_steps_separated"].includes(
          key,
        ),
    ),
  );

  return {
    title: input.title,
    preconditions: String(input.custom_preconds ?? ""),
    references: String(input.refs ?? ""),
    priority: String(input.priority_id ?? ""),
    type: String(input.type_id ?? ""),
    steps,
    customFields,
  };
}

export function deriveEnvironmentMetadata(
  fields: unknown,
  projectId: number,
  templateId: number,
): EnvironmentMetadata {
  if (!Array.isArray(fields)) {
    throw new HttpError(
      502,
      "Unsupported TestRail field configuration format.",
    );
  }

  const envField = fields.find(
    (field) => (field as CaseField).system_name === "custom_test_env",
  ) as CaseField | undefined;
  if (!envField) {
    return {
      applies: false,
      required: false,
      options: [],
      defaultSelectedIds: [],
      reason: "No custom_test_env field configured.",
    };
  }

  const applicableConfigs = envField.configs.filter((config) => {
    if (config.context.is_global) {
      return true;
    }
    return config.context.project_ids?.includes(projectId) ?? false;
  });

  if (applicableConfigs.length === 0) {
    return {
      applies: false,
      required: false,
      options: [],
      defaultSelectedIds: [],
      reason: "Environment field is not configured for this project.",
    };
  }

  const projectSpecific =
    applicableConfigs.find((config) => !config.context.is_global) ??
    applicableConfigs[0];
  const templateIds = projectSpecific.options.template_ids;
  if (
    Array.isArray(templateIds) &&
    templateIds.length > 0 &&
    !templateIds.includes(templateId)
  ) {
    return {
      applies: false,
      required: false,
      options: [],
      defaultSelectedIds: [],
      reason: "Environment field does not apply to the selected template.",
    };
  }

  if (!projectSpecific.options.items) {
    throw new HttpError(
      422,
      "Environment field configuration is unsupported: missing option items.",
    );
  }

  const options = projectSpecific.options.items
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [idRaw, ...labelParts] = line.split(",");
      const id = Number(idRaw?.trim());
      const label = labelParts.join(",").trim();
      if (!Number.isInteger(id) || !label) {
        throw new HttpError(
          422,
          "Environment field contains invalid option values.",
        );
      }
      return { id, label };
    });

  return {
    applies: true,
    required: Boolean(projectSpecific.options.is_required),
    options,
    defaultSelectedIds: options.map((option) => option.id),
  };
}
