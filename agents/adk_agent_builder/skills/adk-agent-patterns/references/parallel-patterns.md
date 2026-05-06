# ParallelAgent Patterns — Complete Code Examples

## Pattern 1: Fan-Out Research

Run multiple independent research agents concurrently, then aggregate results.

```python
from google.adk.agents import ParallelAgent, SequentialAgent, LlmAgent


# --- Fan-out: independent analysts ---

market_analyst = LlmAgent(
    name="market_analyst",
    model="gemini-2.5-flash",
    instruction="""Analyze market trends and competitive landscape for: {topic}

Focus on:
- Market size and growth rate
- Key competitors and market share
- Recent market developments
- Growth opportunities

Output a structured market analysis report.
""",
    tools=[search_tool],
    output_key="market_analysis",
)

tech_analyst = LlmAgent(
    name="tech_analyst",
    model="gemini-2.5-flash",
    instruction="""Analyze the technical landscape for: {topic}

Focus on:
- Current technology stack and trends
- Emerging technologies in this space
- Technical risks and challenges
- Innovation opportunities

Output a structured technical analysis report.
""",
    tools=[search_tool],
    output_key="tech_analysis",
)

sentiment_analyst = LlmAgent(
    name="sentiment_analyst",
    model="gemini-2.5-flash",
    instruction="""Analyze public sentiment and social media trends for: {topic}

Focus on:
- Social media mentions and sentiment
- Customer reviews and feedback
- Press coverage tone
- Brand perception

Output a structured sentiment analysis report.
""",
    tools=[search_tool],
    output_key="sentiment_analysis",
)

# All three run concurrently
parallel_research = ParallelAgent(
    name="parallel_research",
    sub_agents=[market_analyst, tech_analyst, sentiment_analyst],
)


# --- Fan-in: aggregation ---

synthesizer = LlmAgent(
    name="synthesizer",
    model="gemini-2.5-pro",
    instruction="""Synthesize these independent analyses into a unified report:

Market Analysis:
{market_analysis}

Technical Analysis:
{tech_analysis}

Sentiment Analysis:
{sentiment_analysis}

Create a comprehensive report with:
1. Executive summary
2. Key findings across all dimensions
3. Risks and opportunities
4. Recommendations
""",
    output_key="final_report",
)


# --- Full pipeline: parallel fan-out → sequential aggregation ---

research_pipeline = SequentialAgent(
    name="research_pipeline",
    sub_agents=[parallel_research, synthesizer],
)
```

## Pattern 2: Parallel Data Processing

Process multiple data sources simultaneously.

```python
from google.adk.agents import ParallelAgent, SequentialAgent, LlmAgent


csv_processor = LlmAgent(
    name="csv_processor",
    model="gemini-2.5-flash",
    instruction="""Process the CSV data source: {csv_path}
Analyze the data and extract key metrics.
Output structured findings.""",
    tools=[read_csv_tool, analyze_tool],
    output_key="csv_findings",
)

api_processor = LlmAgent(
    name="api_processor",
    model="gemini-2.5-flash",
    instruction="""Fetch and process data from API: {api_endpoint}
Analyze the response and extract key metrics.
Output structured findings.""",
    tools=[api_fetch_tool, analyze_tool],
    output_key="api_findings",
)

db_processor = LlmAgent(
    name="db_processor",
    model="gemini-2.5-flash",
    instruction="""Query the database for: {db_query}
Analyze the results and extract key metrics.
Output structured findings.""",
    tools=[sql_tool],
    output_key="db_findings",
)

# Process all sources concurrently
parallel_ingest = ParallelAgent(
    name="parallel_ingest",
    sub_agents=[csv_processor, api_processor, db_processor],
)

# Merge results
merger = LlmAgent(
    name="merger",
    model="gemini-2.5-flash",
    instruction="""Merge findings from all data sources:

CSV: {csv_findings}
API: {api_findings}
Database: {db_findings}

Identify correlations, conflicts, and key insights across sources.
""",
    output_key="merged_findings",
)

ingest_pipeline = SequentialAgent(
    name="ingest_pipeline",
    sub_agents=[parallel_ingest, merger],
)
```

## Pattern 3: Parallel Validation

Run independent validators concurrently to check different quality aspects.

```python
from google.adk.agents import ParallelAgent, LlmAgent


accuracy_checker = LlmAgent(
    name="accuracy_checker",
    model="gemini-2.5-flash",
    instruction="""Check the factual accuracy of: {draft}
Verify claims, statistics, and references.
Output a list of accuracy issues found (or "no issues").
""",
    output_key="accuracy_report",
)

style_checker = LlmAgent(
    name="style_checker",
    model="gemini-2.5-flash",
    instruction="""Check the writing style and tone of: {draft}
Evaluate clarity, consistency, grammar, and tone.
Output a list of style issues found (or "no issues").
""",
    output_key="style_report",
)

compliance_checker = LlmAgent(
    name="compliance_checker",
    model="gemini-2.5-flash",
    instruction="""Check compliance and safety of: {draft}
Look for policy violations, sensitive content, or legal issues.
Output a list of compliance issues found (or "no issues").
""",
    output_key="compliance_report",
)

parallel_validation = ParallelAgent(
    name="parallel_validation",
    sub_agents=[accuracy_checker, style_checker, compliance_checker],
)
```

## Key Points

1. **Each parallel agent MUST have a unique `output_key`** — if two agents
   write to the same key, one will overwrite the other nondeterministically.

2. **Agents must be truly independent** — no agent should read state that
   another parallel agent writes. All inputs should be set before the
   ParallelAgent starts.

3. **Fan-out/Fan-in pattern** — use `SequentialAgent([ParallelAgent(...), aggregator])`
   to first run parallel work, then merge results.

4. **Cost vs speed tradeoff** — parallel execution uses more concurrent API
   calls but reduces wall-clock time. Good for user-facing latency; less
   important for batch processing.

5. **Error handling** — if one parallel agent fails, it does not stop the
   others. The aggregator should handle missing outputs gracefully.

6. **Model selection** — use cheaper/faster models (gemini-2.5-flash) for
   parallel workers and reserve expensive models (gemini-2.5-pro) for the
   aggregator that needs to synthesize multiple inputs.
