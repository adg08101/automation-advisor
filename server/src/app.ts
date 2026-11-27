import express from "express";
import { createApiRouter } from "./routes/api.js";
import type { Services } from "./services/serviceFactory.js";

export type ConnectionInfo = {
  server: { status: "online"; port: number };
  testrail: { baseUrl: string; host: string };
  openai: { model: string };
  note: string;
};

export function createApp(services: Services, connectionInfo?: ConnectionInfo) {
  const app = express();
  app.use(express.json({ limit: "200kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "autoscore-advisor" });
  });

  app.get("/api/connection-info", (_req, res) => {
    const runtimeInfo = connectionInfo ?? buildConnectionInfoFromEnv();
    if (!runtimeInfo) {
      return res.status(503).json({
        error: "Connection info is not available.",
      });
    }
    return res.json(runtimeInfo);
  });

  app.use("/api", createApiRouter(services));

  return app;
}

function buildConnectionInfoFromEnv(): ConnectionInfo | null {
  const portRaw = process.env.PORT;
  const testrailBaseUrl = process.env.TESTRAIL_BASE_URL;
  const openaiModel = process.env.OPENAI_MODEL;

  const port = Number(portRaw);
  if (
    !testrailBaseUrl ||
    !openaiModel ||
    !Number.isInteger(port) ||
    port <= 0
  ) {
    return null;
  }

  try {
    return {
      server: { status: "online", port },
      testrail: {
        baseUrl: testrailBaseUrl,
        host: new URL(testrailBaseUrl).host,
      },
      openai: { model: openaiModel },
      note: "Credentials are server-side only and are never sent to the client.",
    };
  } catch {
    return null;
  }
}
