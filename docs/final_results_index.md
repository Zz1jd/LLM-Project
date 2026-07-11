# Final Results Index

This file records the experiment outputs referenced by the final report. It is intended to prevent confusion between pilot runs, full A/C runs, and the final smoke run.

## Final Report Data Sources

| Purpose | Run or File | Main Output |
|---|---|---|
| Second-stage multi-model baseline | `output/benchmark_summary.csv` | Multi-model initial/final defect counts used for the second-stage comparison. |
| GPT-4o task1-5 A/C pilot | `output/experiments/pilot-ac-gpt4o-task1-5-20260614` | Early text-only vs multimodal pilot data. |
| GPT-4o task6-30 A/C continuation | `output/experiments/pilot-ac-gpt4o-task6-30-20260621` | Remaining task6-30 A/C branches and screenshots. |
| Combined GPT-4o task1-30 A/C aggregate | `output/experiments/combined-gpt4o-ac-task1-30-20260621` | `combined_summary.csv` and `aggregate_metrics.json` used for the final A/C analysis. |
| Final agent-state smoke run | `output/experiments/final-smoke-task1-5-20260629-agent-state` | Final verification after adding agent state, context management, termination reasons, and README updates. |

## Final Smoke Result

The final smoke run covers tasks 1-5 in both modes:

- `text-only`
- `multimodal`

All 10 branches completed successfully:

- `Final_Total = 0`
- `Success = true`
- `Termination_Status = solved`
- `Termination_Reason = resolved`
- `Iterations = 1` for each branch

Primary file:

```text
output/experiments/final-smoke-task1-5-20260629-agent-state/pilot_summary.csv
```

## Task1-30 A/C Aggregate

Primary aggregate files:

```text
output/experiments/combined-gpt4o-ac-task1-30-20260621/combined_summary.csv
output/experiments/combined-gpt4o-ac-task1-30-20260621/aggregate_metrics.json
```

Summary:

| Mode | Branches | Initial Defects | Final Defects | Successes | Repair Iterations | Repair Tokens |
|---|---:|---:|---:|---:|---:|---:|
| text-only | 30 | 80 | 0 | 30 | 27 | 51,647 |
| multimodal | 30 | 80 | 0 | 30 | 31 | 66,020 |

Interpretation:

- Both modes reached zero automated Pa11y/security findings under the current metrics.
- Multimodal screenshot feedback was validated end to end as an observation path.
- The current metrics do not prove that screenshots consistently improve visual layout quality.
- Independent visual layout scoring remains future work.

## Reproducibility Notes

Run local checks:

```bash
npm test
```

This does not call the remote model API.

Run a new smoke experiment with a fresh run id:

```bash
RUN_ID=final-smoke-task1-5-YYYYMMDD \
PILOT_TASKS=task1_login,task2_shopping_cart,task3_chat_ui,task4_dashboard,task5_modal \
PILOT_MODES=text-only,multimodal \
MAX_ITERATIONS=3 \
npm run experiment:pilot
```

This calls the configured remote model API.

## Submission Reminder

Do not submit `.env` or any API key. Keep final reports, source code, and non-secret result summaries together so the reported tables can be traced back to the experiment outputs.
