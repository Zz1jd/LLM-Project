# GPT-4o A/C Experiment: Task 1-30

## Scope

- Model: `gpt-4o`
- Tasks: `task1_login` through `task30_video_player_controls`
- Group A: source code plus Pa11y/ESLint feedback
- Group C: the same inputs plus desktop, mobile, and representative interaction screenshots
- Maximum repair iterations: 3
- Each A/C pair shares one initial artifact
- Vision detail: `low`

The Task6-30 runner also requires every multimodal branch to perform at least one
visual review, including cases where Pa11y and the security scanner initially
report zero defects.

## Aggregate result

| Group | Tasks | Initial defects | Final defects | Successful tasks | Repair iterations | Repair tokens |
|---|---:|---:|---:|---:|---:|---:|
| A: text-only | 30 | 80 | 0 | 30 | 27 | 51,647 |
| C: multimodal | 30 | 80 | 0 | 30 | 31 | 66,020 |

The initial set contained 50 accessibility findings and 30 security findings.
Both groups achieved a 100% measured mitigation rate. Group C used 14,373 more
repair tokens than Group A, an increase of approximately 27.83%. Shared initial
generation consumed 25,146 tokens and is not assigned to either repair group.

Task30 required two repair iterations in both groups. Task15, Task16, Task23,
and Task25 began with zero Pa11y/security findings; their multimodal branches
still performed one screenshot review under the revised vision policy.

## Validation

- All 60 A/C branches across Task1-30 have complete telemetry.
- All final states report zero Pa11y/security defects.
- An independent re-execution of Pa11y, ESLint, and the corrected HTML security
  heuristics against the 50 Task6-30 final artifacts also returned zero defects.
- Task6-30 produced 364 screenshots and 123 HTML artifacts.
- Browser scenarios cover desktop and mobile initial states and, where an action
  is available, interaction states such as modal opening, file upload, carousel
  navigation, autocomplete input, form progression, and comment submission.

## Interpretation and limitation

This experiment validates the complete multimodal transport and repair loop, but
does not demonstrate a higher Pa11y/security success rate for Group C because
both groups reached zero. Screenshot inspection also found remaining visual
problems that the text-based termination criteria cannot measure. For example,
the Task15 mobile cookie controls remain clipped and the Task23 mobile table
still overflows horizontally after multimodal review.

The correct conclusion is therefore that screenshot feedback is operational and
adds visual context, but direct screenshot attachment alone does not guarantee
visual repair. A final efficacy claim requires browser-geometry telemetry or a
separate visual judge, controlled visual-defect tasks, and repeated trials.

## Source runs

```text
pilot-ac-gpt4o-task1-5-20260614
pilot-ac-gpt4o-task6-30-20260621
```

The combined dataset is generated with:

```bash
RUN_IDS=pilot-ac-gpt4o-task1-5-20260614,pilot-ac-gpt4o-task6-30-20260621 \
OUTPUT_ID=combined-gpt4o-ac-task1-30-20260621 \
npm run experiment:aggregate
```
