import request from "supertest";
import { describe, expect, test, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { Services } from "../src/services/serviceFactory.js";

type MockServices = {
  services: Services;
  testrailGet: ReturnType<typeof vi.fn>;
  testrailPost: ReturnType<typeof vi.fn>;
  testrailGetPaginated: ReturnType<typeof vi.fn>;
  openaiEvaluate: ReturnType<typeof vi.fn>;
  openaiGenerate: ReturnType<typeof vi.fn>;
};

function mockServices(): MockServices {
  const testrailGet = vi.fn();
  const testrailPost = vi.fn();
  const testrailGetPaginated = vi.fn();
  const openaiEvaluate = vi.fn();
  const openaiGenerate = vi.fn();

  const services = {
    testrail: {
      get: testrailGet,
      post: testrailPost,
      getPaginated: testrailGetPaginated,
    },
    openai: {
      evaluateCase: openaiEvaluate,
      generateFromCode: openaiGenerate,
    },
  } as unknown as Services;

  return {
    services,
    testrailGet,
    testrailPost,
    testrailGetPaginated,
    openaiEvaluate,
    openaiGenerate,
  };
}

describe("api routes", () => {
  test("health endpoint", async () => {
    const { services } = mockServices();
    const app = createApp(services);
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
  });

  test("connection info endpoint returns safe metadata", async () => {
    const { services } = mockServices();
    const app = createApp(services, {
      server: { status: "online", port: 4000 },
      testrail: {
        baseUrl: "https://example.testrail.io",
        host: "example.testrail.io",
      },
      openai: { model: "gpt-4.1-mini" },
      note: "Credentials are server-side only and are never sent to the client.",
    });
    const response = await request(app).get("/api/connection-info");
    expect(response.status).toBe(200);
    expect(response.body.openai.model).toBe("gpt-4.1-mini");
  });

  test("connection info endpoint can load from environment", async () => {
    const previousPort = process.env.PORT;
    const previousBaseUrl = process.env.TESTRAIL_BASE_URL;
    const previousModel = process.env.OPENAI_MODEL;

    process.env.PORT = "8787";
    process.env.TESTRAIL_BASE_URL = "https://example.testrail.io";
    process.env.OPENAI_MODEL = "gpt-4.1-mini";

    const { services } = mockServices();
    const app = createApp(services);
    const response = await request(app).get("/api/connection-info");
    expect(response.status).toBe(200);
    expect(response.body.server.port).toBe(8787);

    process.env.PORT = previousPort;
    process.env.TESTRAIL_BASE_URL = previousBaseUrl;
    process.env.OPENAI_MODEL = previousModel;
  });

  test("score endpoint returns evaluation", async () => {
    const { services, testrailGet, openaiEvaluate } = mockServices();
    testrailGet.mockResolvedValue({
      id: 1,
      title: "Case",
      custom_steps_separated: [{ content: "Do", expected: "Done" }],
    });
    openaiEvaluate.mockResolvedValue({
      automationFeasibility: 8,
      businessValue: 8,
      descriptionQuality: 7,
      repeatability: 9,
      locatorStability: 8,
      dataComplexity: 4,
      maintenanceRisk: 4,
      roi: 8,
      estimatedEffort: "Medium",
      risks: ["Selectors"],
      reasoning: "Good",
      suggestedPlaywrightTestName: "case-1",
      suggestedPageObjects: ["LoginPage"],
    });
    const app = createApp(services);
    const response = await request(app).post("/api/score").send({ caseId: 1 });
    expect(response.status).toBe(200);
    expect(response.body.finalScore).toBeTypeOf("number");
  });

  test("score endpoint validates positive case ID", async () => {
    const { services } = mockServices();
    const app = createApp(services);
    const response = await request(app).post("/api/score").send({ caseId: 0 });
    expect(response.status).toBe(400);
  });

  test("generation rejects implausible test", async () => {
    const { services, openaiGenerate } = mockServices();
    openaiGenerate.mockResolvedValue({
      isPlausible: false,
      rejectionReason: "Missing body",
      caveats: [],
    });
    const app = createApp(services);
    const response = await request(app)
      .post("/api/generate-from-code")
      .send({ code: "function x(){ return 1; }" });
    expect(response.status).toBe(422);
  });

  test("generation rejects malformed model payload", async () => {
    const { services, openaiGenerate } = mockServices();
    openaiGenerate.mockResolvedValue({
      isPlausible: true,
      title: "Generated",
      steps: [],
      caveats: [],
    });
    const app = createApp(services);
    const response = await request(app)
      .post("/api/generate-from-code")
      .send({ code: "test('x', async () => { expect(true).toBe(true); }){}" });
    expect(response.status).toBe(502);
  });

  test("case creation validates section-template and creates case", async () => {
    const { services, testrailGet, testrailGetPaginated, testrailPost } =
      mockServices();
    testrailGet
      .mockResolvedValueOnce([{ id: 4, name: "Test Case (Steps)" }])
      .mockResolvedValueOnce([
        {
          system_name: "custom_test_env",
          type_id: 12,
          configs: [
            {
              context: { is_global: false, project_ids: [1] },
              options: {
                is_required: true,
                template_ids: [4],
                items: "1,Chrome\n2,Firefox",
              },
            },
          ],
        },
      ]);
    testrailGetPaginated.mockResolvedValue([{ id: 8, suite_id: 2 }]);
    testrailPost.mockResolvedValue({
      id: 55,
      title: "Created",
    });
    const app = createApp(services);
    const response = await request(app)
      .post("/api/projects/1/suites/2/sections/8/cases")
      .send({
        title: "Created",
        templateId: 4,
        environmentIds: [1],
        steps: [{ action: "Open app", expectedResult: "Home shown" }],
      });
    expect(response.status).toBe(201);
    expect(response.body.case.id).toBe(55);
  });

  test("case creation requires environment when field is required", async () => {
    const { services, testrailGet, testrailGetPaginated } = mockServices();
    testrailGet
      .mockResolvedValueOnce([{ id: 4, name: "Test Case (Steps)" }])
      .mockResolvedValueOnce([
        {
          system_name: "custom_test_env",
          type_id: 12,
          configs: [
            {
              context: { is_global: false, project_ids: [1] },
              options: {
                is_required: true,
                template_ids: [4],
                items: "1,Chrome\n2,Firefox",
              },
            },
          ],
        },
      ]);
    testrailGetPaginated.mockResolvedValue([{ id: 8, suite_id: 2 }]);
    const app = createApp(services);
    const response = await request(app)
      .post("/api/projects/1/suites/2/sections/8/cases")
      .send({
        title: "Created",
        templateId: 4,
        environmentIds: [],
        steps: [{ action: "Open app", expectedResult: "Home shown" }],
      });
    expect(response.status).toBe(422);
  });

  test("case creation rejects template not available in project", async () => {
    const { services, testrailGet, testrailGetPaginated } = mockServices();
    testrailGet
      .mockResolvedValueOnce([{ id: 2, name: "Other" }])
      .mockResolvedValueOnce([]);
    testrailGetPaginated.mockResolvedValue([{ id: 8, suite_id: 2 }]);
    const app = createApp(services);
    const response = await request(app)
      .post("/api/projects/1/suites/2/sections/8/cases")
      .send({
        title: "Created",
        templateId: 4,
        steps: [{ action: "Open app", expectedResult: "Home shown" }],
      });
    expect(response.status).toBe(422);
  });
});
