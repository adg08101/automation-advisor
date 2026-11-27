# AutoScore Advisor

AutoScore Advisor is a local QA assistant that connects to **TestRail** and **OpenAI** to:

- Browse TestRail projects, suites, section hierarchies, and case summaries.
- Score an existing TestRail case for automation suitability.
- Create a manual TestRail case in a selected section.
- Optionally generate case title + ordered manual steps from pasted test code.

> AI output is advisory only and must be reviewed before submission.

## Stack

- **Server:** Node.js, TypeScript, Express, Axios, OpenAI Node SDK, Zod, dotenv
- **Client:** React, TypeScript, Vite, Tailwind CSS
- **Testing:** Vitest, Supertest, Testing Library

## Node requirement

- Minimum tested version: **Node.js 20.11+**

## Repository structure

```text
automation-advisor/
├─ client/                     # React + Vite frontend
├─ server/                     # Express backend
├─ start-autoscore-advisor.bat # optional Windows launcher
└─ README.md
```

## Security and local-use model

- Credentials are used **only on the server**.
- The frontend does not store or expose API keys.
- This app is intended for **local-only use**.
- There is **no built-in authentication** in this implementation.
- If exposed to a network, anyone with access to the server can call its API.
- CORS is not used as an auth mechanism and does not secure an unauthenticated API.

## Environment setup

1. Copy `server/.env.example` to `server/.env`.
2. Fill placeholders with your values.

`server/.env.example`:

```env
TESTRAIL_BASE_URL=https://example.testrail.io
TESTRAIL_USERNAME=qa@example.com
TESTRAIL_API_KEY=replace-with-api-key
OPENAI_API_KEY=replace-with-openai-key
OPENAI_MODEL=gpt-4.1-mini
PORT=4000
```

Required settings:

- `TESTRAIL_BASE_URL`
- `TESTRAIL_USERNAME`
- `TESTRAIL_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Optional:

- `PORT` (defaults to `4000`)

The server fails fast at startup when required settings are missing/invalid.

## Install

```powershell
cd "c:\Users\Ahmed\Desktop\Home\PROYECTOS\automation-advisor\server"
npm install

cd "c:\Users\Ahmed\Desktop\Home\PROYECTOS\automation-advisor\client"
npm install
```

## Development

Run in two terminals:

```powershell
cd "c:\Users\Ahmed\Desktop\Home\PROYECTOS\automation-advisor\server"
npm run dev
```

```powershell
cd "c:\Users\Ahmed\Desktop\Home\PROYECTOS\automation-advisor\client"
npm run dev
```

Optional Windows launcher:

```powershell
cd "c:\Users\Ahmed\Desktop\Home\PROYECTOS\automation-advisor"
.\start-autoscore-advisor.bat
```

The client proxies `/api` and `/health` to `http://localhost:4000`.

## Build, lint, test

Server:

```powershell
cd "c:\Users\Ahmed\Desktop\Home\PROYECTOS\automation-advisor\server"
npm run lint
npm run test
npm run build
```

Client:

```powershell
cd "c:\Users\Ahmed\Desktop\Home\PROYECTOS\automation-advisor\client"
npm run lint
npm run test
npm run build
```

## User workflows

### 1) Scorer

- Enter a positive numeric TestRail case ID.
- Server fetches case details from TestRail.
- Case content is sanitized before sending to OpenAI.
- OpenAI returns structured scoring JSON.
- Server validates and computes final 0–100 score.
- UI displays category scores, recommendation, effort, risks, reasoning, and suggestions.

### 2) Browse projects/suites/sections/cases

- Open **Projects** tab.
- Select project and suite.
- View nested sections and cases by section.
- Expand/collapse section branches.
- Select a section as create destination (including empty sections).
- Click case summary to open **Scorer** with case ID pre-filled.

### 3) Create manual case

- Choose project/suite/section.
- Provide title (required, max 250), template, optional preconditions.
- Add/edit ordered action + expected-result steps.
- Environment field (`custom_test_env`) is discovered dynamically from TestRail field config.
- If required and applicable, at least one environment must be selected.
- Submit creates TestRail case via `add_case/{section_id}`.
- On uncertain network/server failure, UI instructs user to check TestRail before retrying.

### 4) Generate title and steps from code

- Paste up to 30,000 characters of test code.
- Code is treated as data and never executed.
- Server sanitizes input and requests structured generation from OpenAI.
- If plausible: generated title + ordered steps replace current title and all steps.
- Template, preconditions, and environments remain unchanged.
- If implausible/incomplete: useful rejection message, existing form data remains intact.

## Scoring model

Model outputs these dimensions (0–10 each):

- `automationFeasibility`
- `businessValue`
- `descriptionQuality` (shown, not used in final score)
- `repeatability`
- `locatorStability`
- `dataComplexity`
- `maintenanceRisk`
- `roi`

Final score calculation (server-side):

$$
\text{final} = \text{round}\left(\frac{A + B + R + L + ROI + (10-D) + (10-M)}{70} \times 100\right)
$$

Where each component is clamped to $[0,10]$ before calculation.

Recommendation bands:

- `0-39`: Do Not Automate
- `40-69`: Needs Review
- `70-84`: Good Candidate
- `85-100`: Automate Soon

## Data sanitization and privacy warnings

Before sending TestRail content or pasted code to OpenAI, best-effort redaction masks:

- emails
- URLs
- phone-like numbers
- VIN-like values
- common secret patterns (`token`, `api_key`, `secret`, `password`, bearer tokens)

Notes:

- Redaction is best effort, incomplete, and may alter context.
- Do not paste secrets or sensitive production/customer data.
- OpenAI calls may incur cost.

## API reference

Base URL: `http://localhost:4000`

- `GET /health`
- `GET /api/projects`
- `GET /api/projects/:projectId/suites`
- `GET /api/projects/:projectId/templates`
- `GET /api/projects/:projectId/templates/:templateId/environment-metadata`
- `GET /api/projects/:projectId/suites/:suiteId/tree`
- `POST /api/score`
- `POST /api/generate-from-code`
- `POST /api/projects/:projectId/suites/:suiteId/sections/:sectionId/cases`

### Example: score request

```http
POST /api/score
Content-Type: application/json

{
  "caseId": 1234
}
```

Example response (fictional):

```json
{
  "caseId": 1234,
  "caseTitle": "User can reset password",
  "evaluation": {
    "automationFeasibility": 8,
    "businessValue": 9,
    "descriptionQuality": 7,
    "repeatability": 9,
    "locatorStability": 7,
    "dataComplexity": 4,
    "maintenanceRisk": 3,
    "roi": 8,
    "estimatedEffort": "Medium",
    "risks": ["OTP test data stability"],
    "reasoning": "Stable user flow with clear assertions.",
    "suggestedPlaywrightTestName": "auth-password-reset.spec.ts",
    "suggestedPageObjects": ["LoginPage", "ResetPasswordPage"]
  },
  "finalScore": 83,
  "recommendation": "Good Candidate",
  "note": "AI output is advisory. Review before making decisions."
}
```

### Example: generate from code

```http
POST /api/generate-from-code
Content-Type: application/json

{
  "code": "test('checkout', async ({ page }) => { ... })"
}
```

### Example: create case

```http
POST /api/projects/1/suites/2/sections/10/cases
Content-Type: application/json

{
  "title": "Checkout applies coupon",
  "templateId": 4,
  "preconditions": "User is logged in and cart has one item.",
  "environmentIds": [1, 2],
  "steps": [
    { "action": "Open checkout page", "expectedResult": "Checkout page appears" },
    { "action": "Apply coupon SAVE10", "expectedResult": "Total updates by 10%" }
  ]
}
```

## Architecture and data flow

### Backend modules (`server/src`)

- `routes/api.ts`: HTTP endpoints, validation, orchestration, error mapping.
- `services/testrailClient.ts`: TestRail HTTP integration, auth, timeout, pagination.
- `services/openaiClient.ts`: OpenAI integration and strict schema validation.
- `services/testrailDomain.ts`: case extraction, environment field discovery rules.
- `services/score.ts`: score + recommendation logic.
- `utils/sanitize.ts`: redaction before AI calls.
- `config/env.ts`: dotenv + startup env validation.

### Frontend modules (`client/src`)

- `App.tsx`: tab navigation, scorer, project tree, create form, generation flow.
- `api.ts`: typed client API calls.
- `types.ts`: shared frontend API contracts.

## Limits and safeguards

- JSON body limit: `200kb`.
- Code generation input limit: `30,000` chars.
- Positive numeric case IDs only.
- Title required and max `250` chars.
- At least one step required, with required action + expected result.
- Prevents duplicate simultaneous create/generate actions in UI.
- No fabricated success fallbacks for upstream calls.

## Troubleshooting

- **Startup env error:** verify `server/.env` includes all required keys.
- **Cannot load TestRail data:** check URL format, credentials, and API key permissions.
- **Template/env mismatch:** select a template that supports separated steps and applicable environment field config.
- **Create failed with uncertainty:** check TestRail for created case before retrying.
- **Generation rejected:** paste complete method/test declaration with body.

## What was implemented

- Complete server and client from scratch with separate manifests and lockfiles.
- TestRail browse endpoints (projects, suites, templates, suite tree, env metadata).
- Scoring endpoint with sanitized input, validated AI output, formula + recommendations.
- Code-to-case generation endpoint with plausibility gate and strict response checks.
- Manual case creation endpoint with section/template/environment applicability checks.
- Responsive dark slate + cyan UI with loading, error, empty, and success states.
- Optional Windows batch launcher.

## What was tested

- **Server tests (Vitest + Supertest):**
  - scoring formula and recommendation boundaries
  - sanitization behavior
  - legacy/separated step extraction
  - route success paths and invalid input handling
  - malformed generation output handling
  - required environment enforcement
  - template availability validation
- **Client tests (Vitest + Testing Library):**
  - scorer flow renders and submits case ID
- Verified `lint`, `test`, and `build` for both server and client.

## Current limitations

- No authentication layer (local use assumption).
- TestRail field config parsing supports expected common structures; unusual custom schemas may require extension.
- AI generation/scoring quality depends on model behavior and provided context.
- Redaction is best-effort and not guaranteed complete.
