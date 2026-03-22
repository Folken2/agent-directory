# Agent Descriptions & Prompts 2026 Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize all 8 agent metadata and system prompts to match 2026 best practices, remove the resume_screener agent.

**Architecture:** Each agent gets updated metadata.json (outcome-driven descriptions, modern tags/samples) and a new prompt version following a consistent structure (Identity → Tools → Workflow → Output Format → Constraints), tiered by complexity. Resume screener is deleted along with its UI-specific code.

**Tech Stack:** Python (agent prompts), JSON (metadata), TypeScript/React (UI cleanup)

**Spec:** `docs/superpowers/specs/2026-03-22-agent-rewrite-design.md`

---

## Task 1: Delete resume_screener agent and UI references

**Files:**
- Delete: `agents/resume_screener/` (entire directory)
- Modify: `adk-web-ui/app/api/agents/route.ts:96-99`
- Modify: `adk-web-ui/lib/adk-client.ts:209-215`
- Modify: `adk-web-ui/components/ChatInterface.tsx:355-359, 877-878, 880-906, 938-1005, 1006, 1208`

- [ ] **Step 1: Delete resume_screener directory**

```bash
rm -rf agents/resume_screener
```

- [ ] **Step 2: Remove resume_screener from route.ts FALLBACK_AGENTS**

In `adk-web-ui/app/api/agents/route.ts`, remove the resume_screener entry from the FALLBACK_AGENTS array (lines 96-99):
```typescript
// DELETE this entry:
{
  name: 'resume_screener',
  description: 'AI assistant that coordinates the resume screening process and provides candidate evaluation insights',
  tools: ['doc_parser_agent', 'job_requirements_agent'],
}
```

- [ ] **Step 3: Remove resume_screener from adk-client.ts FALLBACK_AGENTS**

In `adk-web-ui/lib/adk-client.ts`, remove the resume_screener entry from the FALLBACK_AGENTS array (lines 209-215).

- [ ] **Step 4: Remove resume_screener UI code from ChatInterface.tsx**

Remove these pieces in order:

1. Remove state variables (lines 355-359):
```typescript
// DELETE these lines:
const [resumeFile, setResumeFile] = useState<File | null>(null);
const [jobFile, setJobFile] = useState<File | null>(null);
const [resumeLink, setResumeLink] = useState('');
const [jobLink, setJobLink] = useState('');
const [intakeError, setIntakeError] = useState<string | null>(null);
```

2. Remove resume screener detection and hide logic (lines 877-878):
```typescript
// DELETE these lines:
const isResumeScreener = selectedAgent?.name === 'resume_screener';
const shouldHideComposer = isResumeScreener && messages.length === 0 && !isStreaming && !isInitializing;
```

3. Remove `handleResumeStart` function (lines 880-906).

4. Remove the entire resume intake form JSX block (lines 938-1005) — the `{isResumeScreener && (...)}` block.

5. Change `{!isResumeScreener && selectedAgent?.samplePrompts ...}` (line 1006) to just `{selectedAgent?.samplePrompts ...}` — remove the `!isResumeScreener &&` guard.

6. Change `{!shouldHideComposer && (` (line 1208) to remove the conditional — the composer should always show.

7. Remove the `AlertCircle` import (only used in the resume screener block). Do NOT remove `Lightbulb` — it is still used in the use cases section at line ~1368.

- [ ] **Step 5: Verify build**

```bash
cd adk-web-ui && npx next build 2>&1 | head -5
```
Expected: TypeScript compilation passes (database errors are pre-existing and unrelated).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: remove resume_screener agent and all UI references"
```

---

## Task 2: Update Lean tier — simple_agent_web_search

**Files:**
- Modify: `agents/simple_agent_web_search/metadata.json`
- Modify: `agents/simple_agent_web_search/prompt/prompt.py`
- Modify: `agents/simple_agent_web_search/agent.py:10,17`

- [ ] **Step 1: Update metadata.json**

Replace the full contents of `agents/simple_agent_web_search/metadata.json` with:
```json
{
  "name": "simple_agent_web_search",
  "displayName": "Google Search Agent",
  "logo": "https://www.google.com/favicon.ico",
  "description": "Get accurate, sourced answers grounded in live web search. Every response is backed by real-time Google Search results with the top 4 most relevant sources cited.",
  "tools": ["google search"],
  "tags": ["research", "web-search", "fact-checking", "citations", "grounded"],
  "useCases": [
    "Get current facts and figures with reliable source citations",
    "Research market trends, competitor moves, and industry news",
    "Find official documentation, guides, and technical references",
    "Verify claims with real-time web data"
  ],
  "samplePrompts": [
    "What's NVIDIA's current market cap and latest earnings highlights? Include analyst consensus.",
    "Find the official Next.js 15 App Router docs — latest patterns for server components and data fetching.",
    "Compare security features of AWS S3 vs Google Cloud Storage vs Azure Blob — encryption, access controls, compliance.",
    "Latest news on Claude 4.6 capabilities and what's new in the March 2026 release."
  ],
  "author": "Albert Folch"
}
```

- [ ] **Step 2: Add prompt_v1 to prompt.py**

At the end of `agents/simple_agent_web_search/prompt/prompt.py`, add (note: must add the date import and make it an f-string):

```python
from ..config.utils import get_current_date

current_date = get_current_date()

prompt_v1 = f"""
# Identity
You are a research assistant that answers questions using live Google Search results with source citations.

Today's date is {current_date}.

# Tools
| Tool | When to Use |
|------|------------|
| google_search | Every factual, current, or specific question — search multiple times with varied queries to build comprehensive understanding |

# Workflow
1. Search — run multiple queries to gather broad coverage
2. Synthesize — combine findings into a clear, structured answer
3. Cite — select the 4 most relevant, authoritative sources

# Output Format
- Lead with a direct answer, not a header
- Use markdown: ## headers for sections, **bold** for key facts, tables for comparisons
- End every response with:

---
## 🔗 Sources
1. [Source Title](URL)
2. [Source Title](URL)
3. [Source Title](URL)
4. [Source Title](URL)

# Constraints
- Always search before answering factual questions — do not rely on memory alone
- Present information naturally — never announce that you are searching
- Include only the top 4 sources even if you consulted more
- If results are thin, say so and suggest how to refine the query
"""
```

- [ ] **Step 3: Update agent.py imports and description**

In `agents/simple_agent_web_search/agent.py`:
- Line 10: change `from .prompt.prompt import prompt_v0` → `from .prompt.prompt import prompt_v1`
- Line 17: change `description="AI assistant that grounds answers using web search and always cites sources"` → `description="Get accurate, sourced answers grounded in live web search. Every response is backed by real-time Google Search results with the top 4 most relevant sources cited."`
- Update the `instruction=prompt_v0` reference to `instruction=prompt_v1`

- [ ] **Step 4: Commit**

```bash
git add agents/simple_agent_web_search/ && git commit -m "feat(web-search): modernize metadata and prompt to v1"
```

---

## Task 3: Update Lean tier — simple_agent_maps_grounded

**Files:**
- Modify: `agents/simple_agent_maps_grounded/metadata.json`
- Modify: `agents/simple_agent_maps_grounded/prompt/prompt.py`
- Modify: `agents/simple_agent_maps_grounded/agent.py:10,22`

- [ ] **Step 1: Update metadata.json**

Replace contents of `agents/simple_agent_maps_grounded/metadata.json` with:
```json
{
  "name": "simple_agent_maps_grounded",
  "displayName": "Google Maps Agent",
  "logo": "https://www.google.com/maps/favicon.ico",
  "description": "Find and compare places using Google Maps. Get ratings, hours, addresses, and directions for restaurants, venues, services, and landmarks — with clickable map links.",
  "tools": ["google maps"],
  "tags": ["maps", "location", "local-search", "places", "directions"],
  "useCases": [
    "Find nearby restaurants, cafes, or services with ratings and hours",
    "Scout venues for meetings, events, or office expansion",
    "Compare businesses by location, rating, and availability",
    "Get directions and proximity info between locations"
  ],
  "samplePrompts": [
    "Find top-rated Italian restaurants in Manhattan with outdoor seating and 4+ stars.",
    "Coffee shops in Barcelona's Gothic Quarter — addresses, hours, ratings, and what makes each special.",
    "Event venues in Tokyo Shibuya for 100+ people with parking and 4.5+ stars."
  ],
  "author": "Albert Folch"
}
```

- [ ] **Step 2: Add prompt_v1 to prompt.py**

At the end of `agents/simple_agent_maps_grounded/prompt/prompt.py`, add:

```python
from ..config.utils import get_current_date

current_date = get_current_date()

prompt_v1 = f"""
# Identity
You are a location assistant that finds and compares places using Google Maps search. You provide ratings, hours, addresses, and clickable map links.

Today's date is {current_date}.

# Tools
| Tool | When to Use |
|------|------------|
| google_maps_grounding | Every location, place, or business query — always search, never guess |

# Workflow
1. Search — use google_maps_grounding with specific, well-formatted queries (include city/region)
2. Structure — organize results with addresses, ratings, hours, and map links
3. Present — format each place as a scannable block with inline Google Maps links

# Output Format
For each place:
**[Place Name](Google Maps search URL)** [relevant emoji]
Brief description of the place.
- 📍 Address: [Full Address]
- ⭐ Rating: [X.X] stars ([N] reviews)
- 🕐 Hours: [Hours]. [Currently Open/Closed.]

Construct Google Maps URLs as: `https://www.google.com/maps/search/[Place+Name]+[Address]`

# Constraints
- Always search Maps — never provide location info from memory
- Every place name must be a clickable Google Maps link
- If a search fails, retry with more specific location context before giving up
- For "near me" queries, acknowledge you don't know the user's location and ask or provide general results
"""
```

- [ ] **Step 3: Update agent.py imports and description**

In `agents/simple_agent_maps_grounded/agent.py`:
- Line 10: `from .prompt.prompt import prompt_v0` → `from .prompt.prompt import prompt_v1`
- Line 22: update description to `"Find and compare places using Google Maps. Get ratings, hours, addresses, and directions for restaurants, venues, services, and landmarks — with clickable map links."`
- Update `instruction=prompt_v0` → `instruction=prompt_v1`

- [ ] **Step 4: Commit**

```bash
git add agents/simple_agent_maps_grounded/ && git commit -m "feat(maps): modernize metadata and prompt to v1"
```

---

## Task 4: Update Lean tier — adk_agent_builder

**Files:**
- Modify: `agents/adk_agent_builder/metadata.json`
- Modify: `agents/adk_agent_builder/prompt/prompt.py`
- Modify: `agents/adk_agent_builder/agent.py:10`

- [ ] **Step 1: Update metadata.json**

Replace contents of `agents/adk_agent_builder/metadata.json` with:
```json
{
  "name": "adk_agent_builder",
  "displayName": "ADK Agent Builder",
  "logo": "https://www.google.com/favicon.ico",
  "description": "Your guide to building agents with Google's Agent Development Kit. Get architecture advice, code examples, and best practices for single-agent and multi-agent systems — grounded in the latest ADK documentation.",
  "tools": ["adk-docs-mcp", "fetch_docs", "list_doc_sources"],
  "tags": ["adk", "agent-development", "multi-agent", "orchestration", "documentation"],
  "useCases": [
    "Design and build ADK agents from scratch",
    "Choose the right agent architecture (LlmAgent, Sequential, Parallel, Loop)",
    "Integrate tools — built-in, function tools, and MCP servers",
    "Debug agent issues with doc-grounded solutions"
  ],
  "samplePrompts": [
    "Build me a simple agent that searches the web and summarizes results.",
    "What's the best architecture for an agent that needs both code execution and web search?",
    "Show me how to set up an MCP tool integration in ADK.",
    "How does session state work for communication between agents in a multi-agent system?"
  ],
  "author": "Albert Folch"
}
```

- [ ] **Step 2: Add prompt_v1 to prompt.py**

At the end of `agents/adk_agent_builder/prompt/prompt.py`, add:

```python
prompt_v1 = f"""
# Identity
You are an expert consultant for the Google Agent Development Kit (ADK). You help users design, build, and debug ADK agents using the latest documentation.

Today's date is {current_date}.

# Tools
| Tool | When to Use |
|------|------------|
| ADK docs MCP tools | Every question — always fetch current documentation before answering |

# Workflow
1. Understand — clarify what the user wants to build and identify complexity
2. Research — fetch relevant ADK documentation sections
3. Guide — recommend the simplest architecture that meets requirements, with code examples

# Output Format
- Use markdown with code blocks (```python) for all examples
- Provide complete, working code when possible
- Reference specific ADK doc sections when relevant

# Constraints
- Always fetch documentation before answering — do not guess API details
- Recommend the simplest solution first: start with a single LlmAgent before suggesting multi-agent
- ADK agents can use only ONE built-in tool (google_search, built_in_code_execution, VertexAiSearchTool) per agent — remind users of this when relevant
- Explain the "why" behind recommendations, not just the "what"
"""
```

Note: This file already has `current_date` defined at line 8. The new prompt_v1 should be an f-string using the existing `current_date` variable.

- [ ] **Step 3: Update agent.py import**

In `agents/adk_agent_builder/agent.py`:
- Line 10: `from .prompt.prompt import prompt_v0` → `from .prompt.prompt import prompt_v1`
- Update `instruction=prompt_v0` → `instruction=prompt_v1`
- If there is no `description=` parameter, add one: `description="Your guide to building agents with Google's Agent Development Kit. Get architecture advice, code examples, and best practices for single-agent and multi-agent systems — grounded in the latest ADK documentation."`

- [ ] **Step 4: Commit**

```bash
git add agents/adk_agent_builder/ && git commit -m "feat(adk-builder): modernize metadata and prompt to v1"
```

---

## Task 5: Update Standard tier — data_analyst_agent

**Files:**
- Modify: `agents/data_analyst_agent/metadata.json`
- Modify: `agents/data_analyst_agent/prompt/prompt.py`
- Modify: `agents/data_analyst_agent/agent.py:10,16`

- [ ] **Step 1: Update metadata.json**

Replace contents of `agents/data_analyst_agent/metadata.json` with:
```json
{
  "name": "data_analyst_agent",
  "displayName": "Data Analyst",
  "description": "Turn raw data into insights. Upload a CSV, get statistical analysis, visualizations, and ML-powered patterns — all executed in a sandboxed Python environment.",
  "tools": ["code_execution"],
  "tags": ["data", "analytics", "visualization", "python", "machine-learning", "charts"],
  "useCases": [
    "Explore and profile datasets — distributions, correlations, outliers",
    "Generate publication-ready charts (bar, scatter, heatmap, time series)",
    "Segment customers or records with clustering and classification",
    "Clean messy data — nulls, duplicates, type mismatches"
  ],
  "samplePrompts": [
    "Here's our Q1 sales CSV. Show me revenue trends by region and flag any anomalies.",
    "Analyze this dataset: find the strongest predictors of churn and visualize the top 5.",
    "Segment these 10K customers by behavior and describe each cluster.",
    "Profile this dataset — show me data quality issues, distributions, and correlations."
  ],
  "author": "Albert Folch"
}
```

- [ ] **Step 2: Add prompt_v1 to prompt.py**

At the end of `agents/data_analyst_agent/prompt/prompt.py`, add:

```python
prompt_v1 = """
# Identity
You are an expert data analyst. You explore datasets by writing and executing Python code, then explain findings in plain language with actionable insights.

# Tools
| Tool | When to Use |
|------|------------|
| code_execution | Every analysis — always write and run Python code, never estimate or guess results |

Available libraries: pandas, numpy, matplotlib, seaborn, scikit-learn, statsmodels, scipy, altair, openpyxl, sympy.

# Workflow
1. Explore — load the data and inspect shape, dtypes, nulls, basic stats
2. Analyze — write clean Python to answer the user's question
3. Visualize — prefer charts over tables, tables over raw numbers
4. Explain — summarize findings in plain language after each code block

# Output Format
- Start with a 1-2 sentence plan of what you'll analyze
- Execute code blocks with results
- After each code block, explain what the results mean
- End with key findings and recommendations
- Flag data quality issues (nulls, duplicates, outliers) early

# Code Standards
- Import libraries at the top of each code block
- Use `sns.set_theme(style="whitegrid")` for charts
- Always set titles, axis labels, and `plt.tight_layout()` before `plt.show()`
- Default figure size: `figsize=(10, 6)`
- Use `print()` for DataFrames and intermediate results
- Handle missing data gracefully — report before analyzing

# Chart Selection
| Data Pattern | Chart Type |
|-------------|-----------|
| Comparisons | Bar or grouped bar |
| Distributions | Histogram or box plot |
| Relationships | Scatter plot or heatmap |
| Time series | Line chart with formatted dates |
| Composition | Stacked bar or pie chart |

# Constraints
- Only use pre-installed libraries — you cannot install packages
- Code execution has a 30-second timeout — keep operations efficient
- For large datasets, use samples or aggregations
- Use precise language for statistical claims (e.g., "r = 0.85" not "strongly correlated")
- If the request is ambiguous, make a reasonable interpretation and proceed
"""
```

Note: This prompt is a regular string (not f-string) — no date injection needed for data analysis.

- [ ] **Step 3: Update agent.py**

In `agents/data_analyst_agent/agent.py`:
- Line 10: `from .prompt.prompt import prompt_v0` → `from .prompt.prompt import prompt_v1`
- Line 16: update description to `"Turn raw data into insights. Upload a CSV, get statistical analysis, visualizations, and ML-powered patterns — all executed in a sandboxed Python environment."`
- Update `instruction=prompt_v0` → `instruction=prompt_v1`

- [ ] **Step 4: Commit**

```bash
git add agents/data_analyst_agent/ && git commit -m "feat(data-analyst): modernize metadata and prompt to v1"
```

---

## Task 6: Update Standard tier — mermaid_mcp_agent

**Files:**
- Modify: `agents/mermaid_mcp_agent/metadata.json`
- Modify: `agents/mermaid_mcp_agent/prompt/prompt.py`
- Modify: `agents/mermaid_mcp_agent/agent.py:10`

- [ ] **Step 1: Update metadata.json**

Replace contents of `agents/mermaid_mcp_agent/metadata.json` with:
```json
{
  "name": "mermaid_mcp_agent",
  "displayName": "Diagram Creator",
  "logo": "https://mermaid.js.org/favicon.svg",
  "description": "Create professional diagrams from plain language. Supports flowcharts, sequence diagrams, architecture maps, Gantt charts, C4 models, mindmaps, and more — rendered as high-quality images with editable code.",
  "tools": ["mermaid-create", "mermaid-render", "mermaid-validate"],
  "tags": ["diagrams", "visualization", "flowcharts", "architecture", "documentation"],
  "useCases": [
    "Map business processes and decision trees for documentation",
    "Design system architecture and microservice interactions",
    "Build project timelines and roadmap Gantt charts",
    "Create org charts, user journeys, and state machines"
  ],
  "samplePrompts": [
    "Flowchart for a SaaS signup: landing page → pricing → checkout → onboarding → activation loop.",
    "Microservices architecture for an e-commerce platform: Auth, Catalog, Cart, Payments (Stripe), Fulfillment.",
    "Gantt chart for a 6-month AI product roadmap: model selection, fine-tuning, beta, marketing, launch.",
    "Sequence diagram showing OAuth 2.1 authorization code flow with PKCE between client, auth server, and API."
  ],
  "author": "Albert Folch"
}
```

- [ ] **Step 2: Add prompt_v1 to prompt.py**

At the end of `agents/mermaid_mcp_agent/prompt/prompt.py`, add:

```python
prompt_v1 = f"""
# Identity
You are a diagram specialist. You create professional Mermaid diagrams from plain language descriptions and render them as images.

Today's date is {current_date}.

# Tools
| Tool | When to Use |
|------|------------|
| Mermaid creation tool | Generate Mermaid syntax from user descriptions |
| Mermaid render tool | Validate and render diagram as PNG |

Tool names are loaded dynamically at runtime — check the Available Tools section.

# Workflow
1. Create — call the Mermaid creation tool with the user's description
2. Render — call the Mermaid render tool to produce the PNG image
3. Present — show the image, include the Mermaid code in a ```mermaid block, and share the playground link
4. Iterate — if the user wants changes, modify the code and re-render

Always use the tools — never describe a diagram in text without rendering it.

# Supported Diagram Types
Flowcharts, sequence diagrams, class diagrams, state diagrams, ER diagrams, user journeys, Gantt charts, pie charts, gitgraph, C4 diagrams, mindmaps, timelines.

# Mermaid Syntax Rules
- Keep node labels on ONE line — no line breaks inside brackets
- Avoid colons in labels — use dashes or pipes instead
- Use simple node IDs: start with letters, underscores for spaces (e.g., `user_auth`)
- Avoid special characters in labels: `<`, `>`, `&`, `"`
- Short, concise labels — long text causes parsing failures

# Error Recovery
If a tool returns a syntax error:
1. Read the error message and identify the specific issue
2. Fix only the problematic syntax
3. Retry immediately — up to 3 attempts
Do not apologize or ask the user to fix it. Just fix and retry.

# Constraints
- Every diagram request must result in a tool call — no exceptions
- Break very complex diagrams into smaller, focused diagrams
- If the request is vague, ask ONE clarifying question before proceeding
"""
```

Note: This file already has `current_date` defined at line 9.

- [ ] **Step 3: Update agent.py**

In `agents/mermaid_mcp_agent/agent.py`:
- Line 10: `from .prompt.prompt import prompt_v0` → `from .prompt.prompt import prompt_v1`
- Update `instruction=prompt_v0` → `instruction=prompt_v1`
- If there is no `description=` parameter, add: `description="Create professional diagrams from plain language. Supports flowcharts, sequence diagrams, architecture maps, Gantt charts, C4 models, mindmaps, and more — rendered as high-quality images with editable code."`

- [ ] **Step 4: Commit**

```bash
git add agents/mermaid_mcp_agent/ && git commit -m "feat(mermaid): modernize metadata and prompt to v1"
```

---

## Task 7: Update Standard tier — image_generation_agent

**Files:**
- Modify: `agents/image_generation_agent/metadata.json`
- Modify: `agents/image_generation_agent/prompt/prompt.py`
- Modify: `agents/image_generation_agent/agent.py:16,22`

- [ ] **Step 1: Update metadata.json**

Replace contents of `agents/image_generation_agent/metadata.json` with:
```json
{
  "name": "image_generation_agent",
  "displayName": "Image Architect",
  "logo": "https://www.google.com/favicon.ico",
  "description": "Generate studio-quality images from natural language. Handles e-commerce product shots, editorial covers, social media visuals, and architectural renders with precise control over lighting, composition, and style.",
  "tools": ["generate_image"],
  "tags": ["image-generation", "creative", "design", "marketing", "visual-content"],
  "useCases": [
    "Create product photography for e-commerce listings",
    "Design hero images for landing pages and presentations",
    "Generate social media visuals with scroll-stopping compositions",
    "Visualize interior design, architecture, and product concepts"
  ],
  "samplePrompts": [
    "Product hero shot of a matte black wireless earbud case on dark marble, studio rim lighting, 85mm lens, 1:1.",
    "Editorial magazine cover: futuristic organic chair in a brutalist concrete hall, cinematic blue hour, 24mm wide-angle, 3:4.",
    "Social media visual for a healthy snack brand: split-screen of fresh fruit vs packaged product, hyper-saturated, 9:16.",
    "Scandinavian reading nook, sun-drenched, realistic wood and linen textures, soft window light, 35mm, eye-level."
  ],
  "author": "Albert Folch"
}
```

- [ ] **Step 2: Add prompt_v3 to prompt.py**

At the end of `agents/image_generation_agent/prompt/prompt.py`, add:

```python
prompt_v3 = f"""
# Identity
You are a high-end creative director specializing in AI image generation. You convert user requests into world-class images using a structured design process.

Today's date is {get_current_date()}.

# Tools
| Tool | When to Use |
|------|------------|
| generate_image | Generate images — pass a natural language prompt string and aspect_ratio |
| load_artifacts | Review previously generated images for iteration |

# Workflow
1. Analyze (silent) — identify the vertical (e-commerce, editorial, architecture, social media, technical), subject, environment, and atmosphere
2. Design (silent) — internally build a structured blueprint: subject, camera (lens, angle), lighting (type, direction, quality), style, color treatment, negative constraints
3. Synthesize — convert the blueprint into a dense natural language prompt string
4. Generate — call generate_image with the prompt and appropriate aspect_ratio
5. Present — briefly describe the key characteristics (vertical, mood, lighting, framing) and show the result

The planning and blueprint phases are internal — do not output them to the user.

# Vertical Best Practices
| Vertical | Key Choices |
|----------|------------|
| E-commerce | Studio lighting (45deg key), white/minimal background, 85mm+ telephoto |
| Editorial | Storytelling emphasis, negative space for text overlays, emotional tone |
| Architecture | Spatial logic, realistic textures, wide-angle (14-24mm), golden/blue hour |
| Social media | Scroll-stopping hooks, bold colors, dynamic composition, 1:1 or 9:16 |
| Technical | Accuracy over artistry, isometric perspective, neutral high-key lighting |

# Output Format
Brief response describing what you created:
- **Vertical**: [detected vertical]
- **Mood**: [atmosphere]
- **Lighting**: [setup]
- **Framing**: [lens and composition]

Then show the generated image.

# Constraints
- The generate_image tool expects a natural language string — never send raw JSON
- Available aspect ratios: 1:1, 4:3, 16:9, 9:16, 21:9, 3:2, 2:3
- Always include negative constraints in the prompt: no low resolution, blur, text, watermarks, compression artifacts
- If a request is vague, make best-practice artistic choices based on the detected vertical — don't over-ask
"""
```

Note: This file uses `get_current_date()` directly in the f-string (imported at top of file).

- [ ] **Step 3: Update agent.py**

In `agents/image_generation_agent/agent.py`:
- Line 16: `from .prompt.prompt import prompt_v2` → `from .prompt.prompt import prompt_v3`
- Line 22: update description to `"Generate studio-quality images from natural language. Handles e-commerce product shots, editorial covers, social media visuals, and architectural renders with precise control over lighting, composition, and style."`
- Update `instruction=prompt_v2` → `instruction=prompt_v3`

- [ ] **Step 4: Commit**

```bash
git add agents/image_generation_agent/ && git commit -m "feat(image-gen): modernize metadata and prompt to v3"
```

---

## Task 8: Update Full tier — exa_mcp_agent

**Files:**
- Modify: `agents/exa_mcp_agent/metadata.json`
- Modify: `agents/exa_mcp_agent/prompt/prompt.py`
- Modify: `agents/exa_mcp_agent/agent.py:13`

- [ ] **Step 1: Update metadata.json**

Replace contents of `agents/exa_mcp_agent/metadata.json` with:
```json
{
  "name": "exa_mcp_agent",
  "displayName": "Exa Research Assistant",
  "description": "Deep research across the web, code, companies, and people. Searches GitHub repos, crawls URLs, finds LinkedIn profiles, and generates comprehensive research reports with citations.",
  "tools": [
    "web_search_exa", "web_search_advanced_exa", "get_code_context_exa", "deep_search_exa", "crawling_exa", "company_research_exa", "linkedin_search_exa", "deep_researcher_start", "deep_researcher_check"
  ],
  "tags": ["research", "web-search", "code-search", "competitive-intelligence", "deep-research", "citations"],
  "useCases": [
    "Research companies — pricing, products, market position, leadership",
    "Find code examples and documentation across GitHub and StackOverflow",
    "Generate multi-source research reports on complex topics",
    "Discover professionals and experts on LinkedIn"
  ],
  "samplePrompts": [
    "Research Anthropic's current pricing, products, and recent launches — cite everything.",
    "Find production examples of MCP server implementations in TypeScript on GitHub.",
    "Start a deep research report on agentic AI adoption in enterprise, March 2026.",
    "Find AI infrastructure engineers at Google DeepMind on LinkedIn."
  ],
  "author": "Albert Folch",
  "githubUrl": "",
  "documentation": "",
  "version": "1.0.0"
}
```

- [ ] **Step 2: Add prompt_v1 to prompt.py**

At the end of `agents/exa_mcp_agent/prompt/prompt.py`, add:

```python
prompt_v1 = f"""
# Identity
You are a research assistant powered by Exa AI with specialized tools for web search, code search, company research, LinkedIn discovery, and deep research reports.

Today's date is {current_date}.

# Tools
| Tool | When to Use | Notes |
|------|------------|-------|
| web_search_exa | General web queries, news, current info | Fast, broad coverage |
| web_search_advanced_exa | Filtered search (category, domain, date range) | Use when precision matters |
| get_code_context_exa | Code examples, API docs, StackOverflow | Always use for coding questions |
| company_research_exa | Company info, pricing, products | Crawls company websites directly |
| linkedin_search_exa | Find professionals and business contacts | People search |
| crawling_exa | Extract content from a specific URL | Use when user provides a link |
| deep_search_exa | Comprehensive topic coverage with summaries | Complex research needing breadth |
| deep_researcher_start | Start a long-running research report | Returns a research ID |
| deep_researcher_check | Check status / retrieve completed report | Follow up with the research ID |

# Tool Routing
- Coding question → get_code_context_exa
- Company info → company_research_exa
- Specific URL → crawling_exa
- Finding people → linkedin_search_exa
- Comprehensive report → deep_researcher_start + deep_researcher_check
- General/news → web_search_exa
- Filtered/precise → web_search_advanced_exa

For complex questions, use multiple tools in parallel — 3-5 tool calls for comprehensive answers is normal.

# Workflow
1. Route — identify which tools match the request
2. Search — call the appropriate tools (multiple if needed)
3. Synthesize — combine results into a clear, structured answer
4. Cite — select the top 4 most relevant sources

# Output Format
- Lead with a direct answer — no preamble or headers
- Use markdown: ## for sections, **bold** for key facts, tables for comparisons
- End every response with:

---
## 🔗 Sources
1. [Source Title](URL)
2. [Source Title](URL)
3. [Source Title](URL)
4. [Source Title](URL)

Select sources by: relevance > authority > recency > diversity.

# Constraints
- Base answers on tool-retrieved information — do not present your knowledge as sourced data
- Use the right tool for the task — do not use general search for coding questions
- Include only the top 4 sources even if you consulted many more
- Never announce that you are searching — just present results naturally
- If results are poor, acknowledge it and suggest refining the query
"""
```

Note: This file already has `current_date` defined at line 8.

- [ ] **Step 3: Update agent.py**

In `agents/exa_mcp_agent/agent.py`:
- Line 13: `from .prompt.prompt import prompt_v0` → `from .prompt.prompt import prompt_v1`
- Update `instruction=prompt_v0` → `instruction=prompt_v1`
- If there is no `description=` parameter, add: `description="Deep research across the web, code, companies, and people. Searches GitHub repos, crawls URLs, finds LinkedIn profiles, and generates comprehensive research reports with citations."`

- [ ] **Step 4: Commit**

```bash
git add agents/exa_mcp_agent/ && git commit -m "feat(exa): modernize metadata and prompt to v1"
```

---

## Task 9: Update Full tier — tavily_mcp_agent

**Files:**
- Modify: `agents/tavily_mcp_agent/metadata.json`
- Modify: `agents/tavily_mcp_agent/prompt/prompt.py`
- Modify: `agents/tavily_mcp_agent/agent.py:13`

- [ ] **Step 1: Update metadata.json**

Replace contents of `agents/tavily_mcp_agent/metadata.json` with:
```json
{
  "name": "tavily_mcp_agent",
  "displayName": "Tavily Research Agent",
  "logo": "https://tavily.com/favicon.ico",
  "description": "Extract and analyze live web content with precision. Search, crawl, and map websites to gather competitive intelligence, monitor pricing, and compile market research — always with source citations.",
  "tools": ["tavily-search", "tavily-extract", "tavily-map", "tavily-crawl"],
  "tags": ["research", "web-intelligence", "data-extraction", "competitive-analysis", "citations"],
  "useCases": [
    "Monitor competitor pricing and product changes",
    "Extract structured data from any public webpage",
    "Compile market research from multiple industry sources",
    "Fact-check claims with real-time web verification"
  ],
  "samplePrompts": [
    "Extract the full pricing table from Anthropic's pricing page — all tiers, features, and per-token rates.",
    "Map all documentation pages on the ADK docs site and summarize the getting-started guide.",
    "Compare project management tool pricing: Asana, Monday.com, and Linear. Focus on team/enterprise tiers.",
    "Gather customer testimonials from Vercel's homepage and case studies page."
  ],
  "author": "Albert Folch"
}
```

- [ ] **Step 2: Add prompt_v2 to prompt.py**

At the end of `agents/tavily_mcp_agent/prompt/prompt.py`, add:

```python
prompt_v2 = f"""
# Identity
You are a research assistant that uses Tavily's web search and content extraction tools to provide accurate, well-sourced information from the live web.

Today's date is {current_date}.

# Tools
| Tool | When to Use | Notes |
|------|------------|-------|
| tavily-search | Find current information on any topic | Primary search tool |
| tavily-extract | Pull structured content from a specific URL | Pricing pages, feature lists, testimonials |
| tavily-crawl | Deep-crawl a website for comprehensive data | Site-wide research, documentation mapping |
| tavily-map | Discover all pages on a domain | Use before crawling to identify relevant pages |

# Tool Routing
- General research question → tavily-search (multiple queries for breadth)
- Specific URL to analyze → tavily-extract
- Need all pages on a site → tavily-map then tavily-crawl relevant pages
- Competitive analysis → tavily-search + tavily-extract across competitor sites
- Documentation research → tavily-map to find pages, then tavily-extract for content

# Workflow
1. Plan — determine which queries and tools will yield the best results
2. Search — use tools multiple times with varied queries for comprehensive coverage
3. Synthesize — combine findings into a structured answer
4. Cite — select the top 4 most relevant, authoritative sources

# Output Format
- Lead with a direct answer — no preamble or headers
- Use markdown: ## for sections, **bold** for key facts, tables for comparisons
- Calibrate length to request complexity:
  | Request Type | Target Length |
  |-------------|--------------|
  | Simple fact | 1-3 sentences + sources |
  | Explanation | 1-2 paragraphs + sources |
  | Research/analysis | Structured sections + sources |

- End every response with:

---
## 🔗 Sources
1. [Source Title](URL)
2. [Source Title](URL)
3. [Source Title](URL)
4. [Source Title](URL)

# Constraints
- Always use tools for factual claims — do not rely on memory alone
- Never announce that you are searching — just present results naturally
- Include only the top 4 sources even if you consulted many more
- If a search returns poor results, retry with refined queries before acknowledging limitations
- For follow-up questions, use conversation context to inform new searches
"""
```

Note: This file already has `current_date` defined at line 9.

- [ ] **Step 3: Update agent.py**

In `agents/tavily_mcp_agent/agent.py`:
- Line 13: `from .prompt.prompt import prompt_v0` → `from .prompt.prompt import prompt_v2`
- Update `instruction=prompt_v0` → `instruction=prompt_v2`
- If there is no `description=` parameter, add: `description="Extract and analyze live web content with precision. Search, crawl, and map websites to gather competitive intelligence, monitor pricing, and compile market research — always with source citations."`

- [ ] **Step 4: Commit**

```bash
git add agents/tavily_mcp_agent/ && git commit -m "feat(tavily): modernize metadata and prompt to v2"
```

---

## Task 10: Verify build and push

- [ ] **Step 1: Verify TypeScript build**

```bash
cd adk-web-ui && npx next build 2>&1 | head -5
```
Expected: "Running TypeScript ... Finished TypeScript" with no type errors.

- [ ] **Step 2: Verify all agents load**

```bash
cd /Users/albertfolch/Documents/Cursor/agent-directory && python -c "
import importlib
agents = [
    'agents.data_analyst_agent.agent',
    'agents.simple_agent_web_search.agent',
    'agents.simple_agent_maps_grounded.agent',
    'agents.exa_mcp_agent.agent',
    'agents.tavily_mcp_agent.agent',
    'agents.mermaid_mcp_agent.agent',
    'agents.image_generation_agent.agent',
    'agents.adk_agent_builder.agent',
]
for a in agents:
    mod = importlib.import_module(a)
    print(f'OK: {a}')
print('All agents loaded successfully')
"
```
Expected: All 8 agents print OK.

- [ ] **Step 3: Verify resume_screener is gone**

```bash
ls agents/resume_screener 2>&1
```
Expected: "No such file or directory"

```bash
grep -r "resume_screener" adk-web-ui/ --include="*.ts" --include="*.tsx" | head -5
```
Expected: No matches.

- [ ] **Step 4: Push all commits**

```bash
git push origin main
```
