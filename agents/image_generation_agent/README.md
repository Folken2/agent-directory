# Image Architect

A creative-director-style image agent. Generates studio-quality images from
natural language and — this is the part that makes it feel different —
**iterates** on those images conversationally. Tell it "warmer light, no
people, tighter crop" and it preserves the subject and composition while
applying the change, instead of regenerating from scratch and drifting.

After every image, the agent surfaces 2-3 specific refinement directions
grounded in what was just made, so the next move is one tap away.

## Architecture

```
LlmAgent: image_generation_agent
  ├─ generate_image    → text-to-image (OpenRouter / Gemini Flash Image)
  ├─ refine_image      → image-to-image (multimodal: prior artifact + edit prompt)
  └─ load_artifacts    → list saved artifacts when filenames are lost (rare)
```

Both `generate_image` and `refine_image` save their output to ADK's artifact
store inside the tool (no separate callback). Filenames follow a predictable
pattern: `generated_image_N.png` / `refined_image_N.png`, versioned by ADK so
each call stays accessible across the session.

## Quick Start

```bash
# 1. Install dependencies (from the repo root)
uv sync --no-install-project

# 2. Add API key to .env
OPENROUTER_API_KEY=your_key_here

# Optional model overrides
FAST_MODEL=openrouter/google/gemini-3-flash-preview
IMAGE_MODEL=openrouter/google/gemini-2.5-flash-image

# 3. Run
adk web
```

Get an OpenRouter key at <https://openrouter.ai/keys>. The image model
(`gemini-2.5-flash-image`) supports both text-to-image generation and
image-to-image refinement — you only need one key for both tools.

## Project Structure

```text
image_generation_agent/
├── agent.py                       # LlmAgent — wires the two image tools
├── tools/
│   └── image_generation.py        # generate_image + refine_image (OpenRouter calls)
├── prompt/
│   ├── prompt.py                  # prompt_v4 — refinement loop instructions
│   └── json-prompt-template.md    # Reference for the structured prompt blueprint
├── config/
│   ├── llm.py                     # FAST_MODEL / IMAGE_MODEL via OpenRouter
│   └── utils.py                   # Date helper
├── metadata.json                  # Directory card metadata
└── README.md
```

## The Refinement Loop

This is the agent's defining feature. The model picks the right tool from
the user's phrasing:

| User says…                              | Agent calls       |
| --------------------------------------- | ----------------- |
| "Generate a magazine cover for…"        | `generate_image`  |
| "Same shot but warmer"                  | `refine_image`    |
| "Now make it 16:9"                      | `refine_image`    |
| "Different concept: a cyberpunk alley"  | `generate_image`  |
| "Remove the people in the background"   | `refine_image`    |

The trick to refinements not drifting: the prompt forces the model to compose
edit instructions that state both **what to preserve** and **what to change**.
A user's "warmer" gets expanded into "same composition, subject, and framing;
warmer color temperature (golden-hour cast)" before being sent to the image
model. Without that expansion, image models treat refinements as fresh
generations with vibe-matching, and identity drifts immediately.

## How Refinements Work Under the Hood

`refine_image` does three things:

1. **Loads the reference** — `tool_context.load_artifact(filename)` returns
   the prior image as a `Part` with `inline_data.data` (raw bytes) and
   `inline_data.mime_type`.
2. **Multimodal request** — sends `[image_url, text]` content (image first,
   so the model treats the text as an edit instruction rather than a fresh
   prompt with reference vibes) to the image model via OpenRouter.
3. **Saves a new versioned artifact** — `refined_image_N.png` rather than
   overwriting the original, so users can compare iterations or revert.

## "Want to refine?" Suggestions

After every successful generation or refinement, the agent ends its message
with a "**Want to refine?**" block proposing 2-3 specific next moves grounded
in what was just produced. Generic suggestions ("warmer", "better composition")
are explicitly forbidden by the prompt — only image-specific prompts like
*"Tighter crop on the bag's stitching detail"* or *"Swap the marble surface
for brushed walnut"* are allowed.

When the user signals they're done ("perfect", "ship it", "thanks"), the
agent skips the suggestions block — agents that won't shut up when you're
satisfied feel pushy.

## Vertical Best Practices

The agent detects which "vertical" your request fits and applies sensible
defaults silently:

| Vertical      | Defaults                                                   |
| ------------- | ---------------------------------------------------------- |
| E-commerce    | Studio lighting (45° key), white/minimal background, 85mm+ |
| Editorial     | Negative space for text, emotional tone                    |
| Architecture  | Wide-angle (14-24mm), golden/blue hour                     |
| Social media  | Bold colors, scroll-stopping hooks, 1:1 or 9:16            |
| Technical     | Isometric perspective, neutral high-key lighting           |

You can always override with explicit instructions ("shoot it on a 35mm
prime instead", "no studio lighting, natural overcast").

## Sample Prompts

- "Product hero shot of a matte black wireless earbud case on dark marble, studio rim lighting, 85mm lens, 1:1."
- "Editorial magazine cover: futuristic organic chair in a brutalist concrete hall, cinematic blue hour, 24mm wide-angle, 3:4."
- "Social media visual for a healthy snack brand: split-screen of fresh fruit vs packaged product, hyper-saturated, 9:16."
- "Scandinavian reading nook, sun-drenched, realistic wood and linen textures, soft window light, 35mm, eye-level."

Then refine: *"warmer color temperature, push the rim-light contrast harder"*,
*"tighter crop on the texture detail"*, *"swap the marble for brushed walnut"*.

## Troubleshooting

**`SSL: CERTIFICATE_VERIFY_FAILED` on local macOS** — already handled. The
tool pins `certifi.where()` as its CA bundle at import, so this works
across local dev, Docker, and Railway without anyone running
`Install Certificates.command`.

**Refinement looks nothing like the original** — the model probably treated
the request as a fresh generation. Check the agent's tool calls in the event
stream: if it called `generate_image` instead of `refine_image`, sharpen
your phrasing to reference the prior result ("same shot but…", "now…",
"keep the subject, change…"). The prompt's tool-routing rules respond to
explicit references.

**Filename not found on refinement** — `refine_image` needs the exact
filename from a prior call. The tool's response always returns
`artifacts: [{filename, version, ...}]` — the agent uses that. If the agent
loses track, it can call `load_artifacts` to re-list everything in the session.

## Resources

- [Google ADK Documentation](https://google.github.io/adk-docs/)
- [Google ADK Artifacts](https://google.github.io/adk-docs/artifacts/)
- [OpenRouter Models](https://openrouter.ai/models)
- [Gemini Image Generation](https://ai.google.dev/gemini-api/docs/image-generation)
