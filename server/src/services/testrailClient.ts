import axios, { type AxiosInstance } from "axios";
import type { Env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

export class TestRailClient {
  private readonly http: AxiosInstance;

  constructor(env: Env) {
    const base = `${env.TESTRAIL_BASE_URL.replace(/\/$/, "")}/index.php?/api/v2`;
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
    } catch {
      throw new HttpError(502, "Failed to fetch data from TestRail.");
    }
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    try {
      const response = await this.http.post<T>(path, body);
      return response.data;
    } catch {
      throw new HttpError(502, "TestRail rejected the request.");
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
