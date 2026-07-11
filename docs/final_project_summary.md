# Final Project Summary

## Project Scope

This project implements a closed-loop frontend code repair benchmark. Each task starts from a prompt, generates a single HTML artifact, evaluates it with accessibility and security tools, and repairs the artifact through a bounded agent loop.

The final implementation focuses on three measurable dimensions:

- Accessibility findings from Pa11y using WCAG2AA.
- Security findings from ESLint and conservative HTML heuristics.
- Optional browser screenshots from Puppeteer for multimodal repair branches.

## Final Agent Loop

The main experiment runner is `src/pilot_experiment.js`. It now records an explicit agent state for each task and branch:

1. Generate or reuse the shared initial artifact.
2. Evaluate and capture screenshots.
3. Record the current observation.
4. Decide whether to repair or terminate.
5. Repair with either text-only feedback or text-plus-screenshot feedback.
6. Re-evaluate and update the state.
7. Stop when the branch is resolved, reaches the iteration budget, or enters a repair plateau.

This keeps the implementation aligned with the report-level algorithm: plan, act, observe, reflect, and decide.

## Shortcut Paths

The agent has three shortcut termination paths:

- `resolved`: all automated accessibility and security checks pass.
- `max_iterations`: the repair budget is exhausted.
- `plateau`: two consecutive repair attempts fail to reduce the issue count.

The multimodal branch may still run one screenshot-informed review when tool errors are initially zero. This validates the screenshot feedback path without changing the main termination criteria.

## Recommended Final Verification

Use the following commands from the project root:

```bash
npm test
npm run vision:preflight
npm run experiment:final-smoke
```

The final smoke run uses tasks 1-5 in both text-only and multimodal modes. Larger runs can still be launched through `npm run experiment:pilot` by setting `RUN_ID`, `PILOT_TASKS`, `PILOT_MODES`, and `MAX_ITERATIONS`.

## Reporting Boundary

The current results support the claim that the closed-loop repair system is operational and effective under the Pa11y/security metrics. The screenshot channel has been validated as an observation mechanism, but the current benchmark should not claim that screenshots consistently improve visual quality. A separate visual layout evaluator would be needed for that claim.
