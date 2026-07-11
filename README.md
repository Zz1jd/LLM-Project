# LLM Frontend Repair Benchmark

This project evaluates a closed-loop repair workflow for frontend code generated from benchmark prompts. Each task produces a single HTML artifact, evaluates it with automated accessibility and security tools, and then repairs it through a bounded agent loop.

## What It Does

- Generates frontend artifacts from task prompts in `prompts/`.
- Evaluates each artifact with Pa11y for WCAG2AA accessibility findings.
- Evaluates JavaScript and HTML security risks with ESLint and conservative static heuristics.
- Captures desktop, mobile, and interaction screenshots with Puppeteer.
- Runs text-only and multimodal repair branches from the same shared initial artifact.
- Records agent observations, repair decisions, shortcut terminations, token usage, screenshots, and final summaries.

## Main Agent Loop

The main experiment runner is `src/pilot_experiment.js`.

For each task and branch, the loop is:

1. Generate or reuse the shared initial artifact.
2. Evaluate accessibility and security findings.
3. Capture browser screenshots.
4. Record the current observation in `agentState`.
5. Decide whether to repair or terminate.
6. Repair with either text-only feedback or text-plus-screenshot feedback.
7. Re-evaluate until the branch is resolved, reaches the iteration limit, or enters a plateau.

The loop records three shortcut paths:

- `resolved`: all automated checks pass.
- `max_iterations`: the configured repair budget is exhausted.
- `plateau`: two consecutive repairs fail to reduce the issue count.

## Setup

Install dependencies from the project root:

```bash
npm install
```

Create a local `.env` file with the API key used by the OpenAI-compatible client:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_BASE_URL=https://api.chatanywhere.tech/v1
TARGET_MODEL=gpt-4o
```

Do not commit `.env`.

## Local Checks

Run syntax checks and unit tests:

```bash
npm test
```

This command does not call the remote model API. It only runs local syntax checks and unit tests.

Verify that the configured model can receive image input:

```bash
npm run vision:preflight
```

This command calls the configured remote model API.

## Final Smoke Experiment

Run a small final experiment on tasks 1-5:

```bash
npm run experiment:final-smoke
```

This command calls the configured remote model API and writes experiment output. To avoid reusing an old run, prefer launching the pilot runner with a fresh run id:

```bash
RUN_ID=final-smoke-task1-5-YYYYMMDD \
PILOT_TASKS=task1_login,task2_shopping_cart,task3_chat_ui,task4_dashboard,task5_modal \
PILOT_MODES=text-only,multimodal \
MAX_ITERATIONS=3 \
npm run experiment:pilot
```

The experiment output is written under:

```text
output/experiments/<run_id>/
```

Important files include:

- `manifest.json`
- `pilot_summary.csv`
- `pilot_summary.partial.csv`
- `<task>/<mode>/telemetry.json`
- `<task>/<mode>/**/screenshots/*.png`

## Experiment Modes

- `text-only`: sends the current artifact and compact text report to the repair model.
- `multimodal`: sends the current artifact, compact text report, and browser screenshots to the repair model.

Both modes use the same shared initial artifact for each task, which keeps the comparison controlled.

## Final Report Runs

The final report refers to these completed runs:

- `combined-gpt4o-ac-task1-30-20260621`
- `pilot-ac-gpt4o-task1-5-20260614`
- `pilot-ac-gpt4o-task6-30-20260621`
- `final-smoke-task1-5-20260629-agent-state`

See `docs/final_results_index.md` for the exact result files and reporting purpose of each run.

## Reporting Boundary

The current benchmark supports claims about automated accessibility and security repair under the implemented Pa11y and ESLint/heuristic metrics. The screenshot channel is implemented and validated as an observation path, but this project should not claim that screenshots consistently improve visual quality without a separate visual layout evaluator.

## Submission Notes

- Do not submit `.env` or any API key.
- Keep `README.md`, `docs/final_project_summary.md`, `docs/full-ac-task1-30-report.md`, and `docs/final_results_index.md` with the source package.
- Include the final report and the cited summary CSV/JSON files when submitting supporting materials.
