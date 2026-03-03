# Data Analyst Agent

AI-powered data analysis agent that writes and executes Python code to analyze your datasets. Built with Google ADK and Gemini's built-in code execution.

## Quick Start

```bash
cd agents/data_analyst_agent
adk web
```

Then paste CSV data or describe a dataset in the chat.

## What It Can Do

- **Exploratory Data Analysis** — shape, dtypes, nulls, summary statistics
- **Visualizations** — bar charts, scatter plots, heatmaps, histograms, line charts (matplotlib + seaborn)
- **Statistics** — correlations, hypothesis tests, distributions (statsmodels + scipy)
- **Machine Learning** — clustering, regression, classification (scikit-learn)
- **Data Cleaning** — null detection, duplicate removal, outlier flagging

## How It Works

This agent uses Gemini's `BuiltInCodeExecutor` — a sandboxed Python environment that runs server-side with pre-installed data science packages:

| Category | Packages |
|----------|----------|
| Data | pandas, numpy |
| Visualization | matplotlib, seaborn, altair |
| Stats/ML | statsmodels, scikit-learn, scipy |
| Documents | openpyxl (Excel), csv |

The agent:
1. Receives your data (pasted CSV, uploaded file, or description)
2. Writes Python code to analyze it
3. Executes the code in the sandbox
4. Returns results with charts rendered inline

## API Keys

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | Yes | Google AI Studio API key (free tier available) |

## Limitations

- **30-second timeout** per code execution
- **~2MB max** for inline data (pasted CSV)
- **No custom packages** — only pre-installed sandbox packages
- **Cannot combine with other tools** — code_executor is exclusive per agent

## Project Structure

```
data_analyst_agent/
├── __init__.py
├── agent.py           # LlmAgent with BuiltInCodeExecutor
├── metadata.json      # Web UI metadata
├── README.md
└── prompt/
    └── prompt.py      # System prompt (versioned: v0, v1, ...)
```
