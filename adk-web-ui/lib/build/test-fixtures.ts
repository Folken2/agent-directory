import type { Build } from './types';

/** The spec's example `builder:build`, shared by unit tests. */
export const BUILD: Build = {
  name: 'research-summarizer',
  package: 'research_summarizer',
  description: 'Searches the web for a topic and writes a sourced one-page summary.',
  options: { with_eval: true, with_slack: false, persona: true },
  models: { fast: 'openrouter/google/gemini-2.5-flash', reasoning: null },
  tools: ['web_search'],
  skills: ['sourced-summary'],
  artifact: 'research-summarizer.zip',
  version: 0,
  files: 41,
  bytes: 58213,
  packagedAt: '2026-10-04T09:12:00Z',
};
