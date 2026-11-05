---
title: ADK code execution: build a data analyst agent
seoTitle: ADK Code Execution: Build a Data Analyst Agent
description: Use BuiltInCodeExecutor in Google ADK to build a data analyst agent: Gemini-only setup, sandbox limits, chart artifacts, prompts and common errors.
published: 2026-11-05
agents: data_analyst_agent
keywords: ADK code execution, BuiltInCodeExecutor, code_executor, Google ADK, Agent Development Kit, data analyst agent, Gemini code execution, ContainerCodeExecutor
---

A model asked to analyse a CSV will happily make up the mean. With code execution it writes Python, runs it in a sandbox and reads the real output before it answers. In Google's Agent Development Kit (ADK) that takes one argument on the agent.

The code below is the [Data Analyst](/agents/data_analyst_agent) on this site. The ADK behaviour was checked against **google-adk 2.10.0**. The sandbox itself is run by Google, so its limits here come from [Google's code execution docs](https://aistudio.google.com/docs/code-execution).

## The short version

Set `code_executor` on an `LlmAgent`. This is the whole agent:

```python
from google.adk.agents import LlmAgent
from google.adk.code_executors import BuiltInCodeExecutor

from .config.llm import MODEL
from .prompt.prompt import prompt_v2

LANGUAGE_INSTRUCTION = (
    "Respond in whatever language the user writes in. Mirror their language "
    "exactly, including any mid-conversation switches.\n\n"
)


root_agent = LlmAgent(
    name="data_analyst_agent",
    model=MODEL,
    description=(
        "Turn raw data into insights with statistical rigor. Upload a CSV, "
        "get exploratory analysis, visualizations, and ML-powered patterns — "
        "every analysis ends with a structured Findings block (top insights, "
        "data quality flags, open questions) and inferential claims carry "
        "effect sizes and sample-size context."
    ),
    code_executor=BuiltInCodeExecutor(),
    instruction=LANGUAGE_INSTRUCTION + prompt_v2,
)
```

Install ADK with `pip install google-adk`, set `GOOGLE_API_KEY` and start it with `adk web`. You don't write a tool or host a sandbox. `BuiltInCodeExecutor` only adds Gemini's code execution tool to the request; Google's servers run the code and return the result in the same response.

## Use a Gemini model

`BuiltInCodeExecutor` asks for a Gemini feature, so this agent can't use the setup most agents on this site share, `LiteLlm` through OpenRouter. It uses a native Gemini model name instead:

```python
import os

from model_factory import make_gemini

MODEL = make_gemini("data_analyst_agent", os.getenv("GEMINI_MODEL", "gemini-3.8-flash"))
```

`make_gemini` is a helper in this repo. Outside a proxy it simply returns the name, so in your own project you can pass `model="gemini-3.8-flash"`.

ADK checks the model name on each request. A name that doesn't look like Gemini raises an error. A Gemini name behind `LiteLlm`, such as `openrouter/google/gemini-3.8-flash`, passes that check and ADK forwards the tool to the provider, but whether the code actually runs then depends on that provider. This agent avoids the question by talking to Gemini directly.

## Know the sandbox limits

These come from Google's docs, and they apply whatever your agent does:

| Limit | What it means |
| --- | --- |
| 30-second runtime | Sample or aggregate large datasets |
| No custom packages | You get Google's list, which includes pandas, numpy, matplotlib, seaborn, scipy, scikit-learn, openpyxl and sympy |
| Charts through matplotlib | The only library supported for graph rendering |
| File size capped by the model's token window | Too large a file returns an error |

Check that list before you name a library in your prompt. If a prompt promises a package the sandbox doesn't have, the model's first attempt fails on the import.

The docs say CSV and text files work best. Code execution has no separate charge: you pay normal token rates, and the generated code and its results count as tokens too.

Can it sit next to other tools? Older advice says no. Google's docs now say Gemini 3 and 4 models can combine built-in tools with function calling, and ADK 2.10 lets you create such an agent. This agent uses code execution alone and that combination hasn't been tested here, so try it before you rely on it.

## Handle the results and charts

A code execution response carries more than text. The parts to look for are `executable_code` (what the model wrote), `code_execution_result` (the outcome and output) and `text`. ADK's `event.is_final_response()` returns `False` while the last part is still a code result, so that check will wait for the model's closing text.

Charts need one more piece. When a response contains an image, ADK saves it through the runner's artifact service, removes the image data from the event and replaces it with the text `Saved as artifact: <file name>`. The event's `actions.artifact_delta` lists the file. To show the chart, read it back from the artifact service; `adk web` and `InMemoryRunner` already provide one.

## Write the prompt for code, not for chat

The executor makes running code possible, and the prompt makes it the rule. This agent's prompt says to use code execution for every analysis: "Always run code; never estimate".

Real numbers can still lead to wrong conclusions, so the prompt also sets what each kind of claim must report. Four of its rows:

```text
| Correlation | `r = X.XX, n = N, p = X.XXX` (Pearson) or specify Spearman/Kendall |
| Group difference | Test name, statistic, `p`, **effect size** (Cohen's d, Hedges' g, η², or Cramér's V) |
| Predictive claim | Train/test split (or CV strategy), holdout metric, **not** training metric |
| Causal claim | Flag as correlation-not-causation unless you have a designed experiment, instrumental variable, or natural experiment |
```

The prompt also tells the agent to warn when the data is too small for a test (under 30 rows for parametric tests, under 10 for any), and to close every answer with the same `## Findings` block: top insights, data quality flags and open questions. A fixed ending makes the output easy to scan and paste into a document.

## When you need your own sandbox

`BuiltInCodeExecutor` is the easiest option, but you can't change its packages or runtime. ADK has others that run the code themselves, using the same `code_executor` argument:

| Executor | Runs code in | Note |
| --- | --- | --- |
| `ContainerCodeExecutor` | A Docker container you choose | Networking off by default; needs `google-adk[extensions]` |
| `GkeCodeExecutor` | A Kubernetes pod | Job or sandbox mode, which differ in isolation |
| `AgentEngineSandboxCodeExecutor` | Google's Agent Engine sandbox | For Vertex AI projects |
| `UnsafeLocalCodeExecutor` | Your own Python process | No isolation: never use it on input you don't trust |

Separately, the [ADK Agent Builder](/agents/adk_agent_builder) on this site installs and tests whole projects in an E2B sandbox through ADK's `E2BEnvironment`, which is a better fit than a code executor when you need files and a long-lived environment. To give an agent outside tools rather than a sandbox, see [how to connect an MCP server](/guides/adk-mcp-toolset). To have several agents check each other's work, see the [deep research pipeline](/guides/adk-deep-research-pipeline).

## Common errors

**`ValueError: Gemini code execution tool is not supported for model …`.** The model name doesn't look like Gemini. ADK raises this when the request is built, not when the agent is created, so the agent starts fine and fails on the first message. Switch to a Gemini model or to a different executor.

**`ValueError: Artifact service is not initialized.`** The model produced a chart and your `Runner` has no artifact service. Pass one, such as `artifact_service=InMemoryArtifactService()`, or use `InMemoryRunner`.

**`400 INVALID_ARGUMENT` with "API key not valid".** Check `GOOGLE_API_KEY` where the agent runs, not just in your local `.env`.

**`402 Payment Required` with "Your prepayment credits are depleted".** The Gemini project is out of prepaid credit. Top it up in AI Studio; no code change will help.

**The analysis hits the time limit.** The 30-second limit applies to the code environment, so have the model sample or aggregate first, and split long work into steps.

**A later code block can't see an earlier variable.** Google's docs don't promise that sandbox state carries over, so don't rely on it. This agent's prompt has each block do its own imports. Load the data again if you're unsure.

## Try it

Open the [Data Analyst](/agents/data_analyst_agent) and paste a small CSV, or attach one with the paperclip, then ask for trends and anomalies. Its page links to the full source on GitHub.
