import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readServerPortFromEnv(): number {
  try {
    const envPath = resolve(__dirname, "../server/.env");
    const content = readFileSync(envPath, "utf8");
    const match = content.match(/^PORT\s*=\s*(\d+)\s*$/m);
    if (match?.[1]) {
      const parsed = Number(match[1]);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch {}
  return 4000;
}

const serverPort = readServerPortFromEnv();
const proxyTarget = `http://localhost:${serverPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
      },
      "/health": {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
  },
});
