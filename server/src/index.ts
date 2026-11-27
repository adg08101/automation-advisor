import { loadEnv } from "./config/env.js";
import { createApp } from "./app.js";
import { createServices } from "./services/serviceFactory.js";

const env = loadEnv();
const services = createServices(env);
const app = createApp(services, {
  server: { status: "online", port: env.PORT },
  testrail: {
    baseUrl: env.TESTRAIL_BASE_URL,
    host: new URL(env.TESTRAIL_BASE_URL).host,
  },
  openai: { model: env.OPENAI_MODEL },
  note: "Credentials are server-side only and are never sent to the client.",
});

app.listen(env.PORT, () => {
  process.stdout.write(
    `AutoScore Advisor server listening on http://localhost:${env.PORT}\n`,
  );
});
