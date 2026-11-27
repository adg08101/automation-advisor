import type { Env } from "../config/env.js";
import { OpenAiAdvisor } from "./openaiClient.js";
import { TestRailClient } from "./testrailClient.js";

export type Services = {
  testrail: TestRailClient;
  openai: OpenAiAdvisor;
};

export function createServices(env: Env): Services {
  return {
    testrail: new TestRailClient(env),
    openai: new OpenAiAdvisor(env),
  };
}
