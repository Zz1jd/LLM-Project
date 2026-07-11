# A/C Multimodal Pilot: Task 1-5

## Experiment design

- Model: `gpt-4o`
- Tasks: `task1_login` through `task5_modal`
- Group A: text-only repair using source code and Pa11y/ESLint feedback
- Group C: multimodal repair using the same inputs plus rendered desktop, mobile, and interaction screenshots
- Maximum repair iterations: 3
- Initial artifact: shared between A and C for each task
- Vision detail: `low`

Run ID:

```text
pilot-ac-gpt4o-task1-5-20260614
```

## Corrected result

An audit found that the original inline-event regular expression matched suffixes
inside normal text, including `content="..."` and JavaScript variable names such
as `confirmation = '...'`. The evaluator was corrected to inspect only real HTML
start-tag attributes. Existing artifacts were then re-evaluated without making
additional model API calls.

| Group | Initial defects | Final defects | Mitigation | Effective repair iterations | Repair tokens |
|---|---:|---:|---:|---:|---:|
| A: text-only | 19 | 0 | 100% | 1 per task | 10,558 |
| C: multimodal | 19 | 0 | 100% | 1 per task | 11,522 |

The multimodal group used 964 additional repair tokens, an increase of
approximately 9.1%. Both groups reached zero Pa11y and security findings after
their first repair.

## Interpretation

The pilot verifies that the complete multimodal path works: Puppeteer renders
the artifact, captures multiple page states, and GPT-4o receives the previous
HTML, structured telemetry, and screenshots in one repair request.

Task 1-5 did not contain sufficiently difficult visual faults to demonstrate a
clear advantage for Group C. Screenshot inspection and source comparison found
small group-specific changes, including contrast adjustments and accessibility
structure changes, but no decisive layout repair that Group A could not make.
This is a useful negative result: Pa11y and the current security checks measure
compliance, not visual quality, so zero tool findings cannot by itself establish
that one repaired interface is visually better.

## Reproduction

Run the full pilot:

```bash
RUN_ID=pilot-ac-gpt4o-task1-5-20260614 \
TARGET_MODEL=gpt-4o \
PILOT_TASKS=task1_login,task2_shopping_cart,task3_chat_ui,task4_dashboard,task5_modal \
PILOT_MODES=text-only,multimodal \
MAX_ITERATIONS=3 \
VISION_DETAIL=low \
npm run experiment:pilot
```

Re-evaluate saved artifacts without calling the model:

```bash
RUN_ID=pilot-ac-gpt4o-task1-5-20260614 npm run experiment:reanalyze
```

The report should use `pilot_summary_corrected.csv`. The original
`pilot_summary.csv` is retained only as an audit record of the pre-correction
evaluator output.

## Recommended next experiment

Use a visual-stress subset with controlled defects such as mobile horizontal
overflow, modal clipping, overlapping controls, unreadable color contrast, and
off-screen focus targets. Add deterministic browser geometry telemetry and a
blind visual-quality rubric. This will test the unique contribution of
screenshot feedback instead of repeating defects already described precisely by
Pa11y or ESLint.
