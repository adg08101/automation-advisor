import axios, { type AxiosInstance } from "axios";
import type { Env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

export class TestRailClient {
  private readonly http: AxiosInstance;

  constructor(env: Env) {
    const normalizedBase = normalizeTestRailBaseUrl(env.TESTRAIL_BASE_URL);
    const base = `${normalizedBase}/index.php?/api/v2`;
    this.http = axios.create({
      baseURL: base,
      timeout: 15000,
      auth: {
        username: env.TESTRAIL_USERNAME,
        password: env.TESTRAIL_API_KEY,
      },
    });
  }

  async get<T>(path: string): Promise<T> {
    try {
      const response = await this.http.get<T>(path);
      return response.data;
    } catch (error) {
      throw mapTestRailError(error, "fetch data");
    }
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    try {
      const response = await this.http.post<T>(path, body);
      return response.data;
    } catch (error) {
      throw mapTestRailError(error, "submit data");
    }
  }

  async getPaginated<T>(path: string, key: string): Promise<T[]> {
    const items: T[] = [];
    let current = `${path}&limit=250&offset=0`;

    while (current) {
      const data = await this.get<Record<string, unknown>>(current);
      if (Array.isArray(data)) {
        return data as T[];
      }

      const batch = data[key];
      if (!Array.isArray(batch)) {
        throw new HttpError(502, "Unexpected TestRail pagination response.");
      }
      items.push(...(batch as T[]));

      const links = data._links as { next?: string } | undefined;
      if (links?.next) {
        const nextPath = links.next
          .replace(/^\/?index\.php\?\/api\/v2\//, "")
          .replace(/^\//, "");
        current = nextPath.startsWith("get_") ? nextPath : "";
      } else {
        current = "";
      }
    }

    return items;
  }
}

function normalizeTestRailBaseUrl(rawBaseUrl: string): string {
  return rawBaseUrl
    .trim()
    .replace(/\/$/, "")
    .replace(/\/index\.php\?.*$/i, "")
    .replace(/\/api\/v2.*$/i, "");
}

function mapTestRailError(error: unknown, action: string): HttpError {
  if (!axios.isAxiosError(error)) {
    return new HttpError(502, `Failed to ${action} from TestRail.`);
  }

  const status = error.response?.status;
  if (status === 401 || status === 403) {
    return new HttpError(
      502,
      "TestRail authentication failed (401/403). Verify TESTRAIL_BASE_URL, TESTRAIL_USERNAME, TESTRAIL_API_KEY, and that this user has access to the target TestRail instance/projects.",
    );
  }

  if (status === 404) {
    return new HttpError(
      502,
      "TestRail endpoint not found (404). Verify TESTRAIL_BASE_URL for your instance.",
    );
  }

  if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
    return new HttpError(
      502,
      "Could not reach TestRail. Verify TESTRAIL_BASE_URL and network connectivity.",
    );
  }

  if (error.code === "ECONNABORTED") {
    return new HttpError(504, "TestRail request timed out. Please retry.");
  }

  if (typeof status === "number") {
    return new HttpError(502, `TestRail request failed with status ${status}.`);
  }

  return new HttpError(502, `Failed to ${action} from TestRail.`);
}
