import axios from "axios";
import type {
  ConnectionInfoResponse,
  EnvironmentMetadata,
  GenerateResponse,
  Project,
  ScoreResponse,
  Suite,
  Template,
  TreeResponse,
} from "./types";

const api = axios.create({
  baseURL: "/api",
  timeout: 15000,
});

export async function getConnectionInfo(signal?: AbortSignal) {
  const { data } = await api.get<ConnectionInfoResponse>("/connection-info", {
    signal,
  });
  return data;
}

export async function getProjects(signal?: AbortSignal) {
  const { data } = await api.get<Project[]>("/projects", { signal });
  return data;
}

export async function getSuites(projectId: number, signal?: AbortSignal) {
  const { data } = await api.get<Suite[]>(`/projects/${projectId}/suites`, {
    signal,
  });
  return data;
}

export async function getTree(
  projectId: number,
  suiteId: number,
  signal?: AbortSignal,
) {
  const { data } = await api.get<TreeResponse>(
    `/projects/${projectId}/suites/${suiteId}/tree`,
    { signal },
  );
  return data;
}

export async function scoreCase(caseId: number) {
  const { data } = await api.post<ScoreResponse>("/score", { caseId });
  return data;
}

export async function getTemplates(projectId: number, signal?: AbortSignal) {
  const { data } = await api.get<Template[]>(
    `/projects/${projectId}/templates`,
    { signal },
  );
  return data;
}

export async function getEnvironmentMetadata(
  projectId: number,
  templateId: number,
  signal?: AbortSignal,
) {
  const { data } = await api.get<EnvironmentMetadata>(
    `/projects/${projectId}/templates/${templateId}/environment-metadata`,
    { signal },
  );
  return data;
}

export async function generateFromCode(code: string) {
  const { data } = await api.post<GenerateResponse>("/generate-from-code", {
    code,
  });
  return data;
}

export async function createCase(
  projectId: number,
  suiteId: number,
  sectionId: number,
  payload: {
    title: string;
    templateId: number;
    preconditions?: string;
    environmentIds?: number[];
    steps: Array<{ action: string; expectedResult: string }>;
  },
) {
  const { data } = await api.post<{
    case: { id: number; title: string; section_id: number };
    note: string;
  }>(
    `/projects/${projectId}/suites/${suiteId}/sections/${sectionId}/cases`,
    payload,
  );
  return data;
}
