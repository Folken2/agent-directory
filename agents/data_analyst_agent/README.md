# Data Analyst

A senior-data-analyst agent. Writes and executes Python in a sandboxed
Gemini environment, then delivers findings with **statistical rigor**
(effect sizes, confidence intervals, sample-size context) closed by a
**structured Findings block** that's the same shape every time — top
insights, data quality flags, open questions.

The structure is deliberate: every analysis ends as a one-pager you can
paste into a doc, not a chat log you have to skim.

## Quick Start

```bash
# 1. Install dependencies (from the repo root)
uv sync --no-install-project

# 2. Add API key to .env
GOOGLE_API_KEY=your_key_here

# Optional model override (must be a Gemini API model id — see "Model constraint" below)
GEMINI_MODEL=gemini-2.5-flash

# 3. Run
adk web
```

Then paste CSV data, describe a dataset, or upload a file in the chat.

Get a Google API key at <https://aistudio.google.com/apikey> (free tier
includes generous code-execution quota).

## Project Structure

```text
data_analyst_agent/
├── agent.py                 # LlmAgent + BuiltInCodeExecutor
├── config/
│   ├── __init__.py
│   └── llm.py               # MODEL constant + model-constraint docs
├── prompt/
│   └── prompt.py            # prompt_v2 — rigor rules + Findings footer
├── metadata.json            # Directory card metadata
└── README.md
```

## Model Constraint

This agent does **not** use the shared `FAST_MODEL` (LiteLlm/OpenRouter)
that every other agent in this directory uses. Reason: its core capability
is `BuiltInCodeExecutor`, a native Gemini API feature for server-side
sandboxed Python. LiteLlm is a chat-completions proxy and doesn't expose
Gemini's code-execution endpoint, so wrapping the model would silently
lose the executor.

The model is therefore a string Gemini ID (default `gemini-2.5-flash`).
Override via `GEMINI_MODEL` env var, but keep it as a native Gemini ID
— don't add an `openrouter/` prefix.

## What It Can Do

- **Exploratory analysis** — shape, dtypes, nulls, summary stats, correlations
- **Statistical testing** — t-tests, ANOVA, chi-squared, regression, with
  effect sizes (Cohen's d, η², Cramér's V) and sample-size caveats
- **Visualizations** — bar, scatter (with regression line), heatmap,
  histogram, KDE, box, violin, time-series line
- **Machine learning** — clustering (KMeans, DBSCAN), classification,
  regression, with proper train/test splits and holdout metrics
- **Data quality audits** — null detection, duplicate handling, outlier
  flagging, type coercion problems

## Statistical Rigor Rules

The prompt enforces these on every inferential claim:

| Claim type        | Required reporting                                                |
| ----------------- | ----------------------------------------------------------------- |
| Correlation       | `r`, `n`, `p` (Pearson by default; specify if Spearman/Kendall)   |
| Group difference  | Test name, statistic, `p`, **effect size**                        |
| Regression        | Coefficient ± 95% CI, `R²`, `n`                                   |
| ML metric         | Metric value, train/test split sizes, baseline comparison         |
| Predictive claim  | Holdout metric, never training metric                             |
| Causal claim      | Flagged as correlation-not-causation unless design supports it    |

Sample-size guard: under 30 observations for parametric tests (or under 10
for any test), the agent says so explicitly rather than reporting the
result as if it were trustworthy.

## The Findings Block

Every response ends with this exact shape, so deliverables are
predictable and scannable:

```markdown
## Findings

**Top insights**
- <insight grounded in a specific result>
- <insight grounded in a specific result>
- <insight grounded in a specific result>

**Data quality flags** (omitted if data was clean)
- <e.g. "12% nulls in `region` — imputed with mode for clustering, dropped for revenue analysis">

**Open questions**
- <follow-up the data can't answer alone>
- <follow-up requiring more data>
```

The Findings block runs even when the user signals they're done — it's
the deliverable, not a suggestion.

## Sandbox Libraries

| Category       | Packages                                       |
| -------------- | ---------------------------------------------- |
| Data           | pandas, numpy                                  |
| Visualization  | matplotlib, seaborn, altair                    |
| Stats          | statsmodels, scipy.stats                       |
| ML             | scikit-learn                                   |
| Math           | sympy, mpmath                                  |
| I/O            | openpyxl (Excel), csv                          |

## Limitations

- **30-second timeout** per code execution — chunk long-running ops or sample
- **~2MB max** for inline data (pasted CSV); for larger files, upload as artifact
- **No custom packages** — only the sandbox-preinstalled set above
- **Cannot combine with other tools** — `BuiltInCodeExecutor` is exclusive
  per agent (no FunctionTools, no MCP, no other code executors)
- **Native Gemini only** — see "Model constraint" above

## Sample Prompts

- "Here's our Q1 sales CSV. Show me revenue trends by region and flag any anomalies."
- "Analyze this dataset: find the strongest predictors of churn and visualize the top 5."
- "Segment these 10K customers by behavior and describe each cluster."
- "Profile this dataset — show me data quality issues, distributions, and correlations."

## Resources

- [Google ADK Documentation](https://google.github.io/adk-docs/)
- [Gemini Code Execution](https://ai.google.dev/gemini-api/docs/code-execution)
- [statsmodels effect sizes](https://www.statsmodels.org/stable/stats.html)
- [scipy.stats reference](https://docs.scipy.org/doc/scipy/reference/stats.html)
