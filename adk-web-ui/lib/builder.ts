/**
 * The agent builder is the site's front door: the home hero and a bare
 * `/chat` both start a conversation with it. Everything else in the
 * directory is shown as an example.
 */

export const BUILDER_AGENT = 'adk_agent_builder';

/** Upper bound for a prompt carried in the `/chat?prompt=` query string. */
export const MAX_BUILDER_PROMPT_LENGTH = 2000;

export const BUILDER_EXAMPLE_PROMPTS: ReadonlyArray<{ label: string; prompt: string }> = [
  {
    label: 'Customer support triage',
    prompt:
      'Design an agent that triages customer support emails, drafts replies from our help center, and escalates refunds to a human.',
  },
  {
    label: 'Research and summarize',
    prompt: 'Build an agent that searches the web for a topic and writes a sourced one-page summary.',
  },
  {
    label: 'Data analysis assistant',
    prompt: 'Design an agent that answers questions about a CSV file with code execution and charts.',
  },
  {
    label: 'Multi-agent content pipeline',
    prompt:
      'Plan a multi-agent pipeline that researches, drafts, and reviews a weekly newsletter before a human approves it.',
  },
];

/** Link that opens a builder chat; with `autoSend` the prompt is sent on arrival. */
export function builderChatHref(prompt: string, { autoSend = true }: { autoSend?: boolean } = {}): string {
  const params = new URLSearchParams({ agent: BUILDER_AGENT });
  const text = prompt.trim().slice(0, MAX_BUILDER_PROMPT_LENGTH);
  if (text) {
    params.set('prompt', text);
    if (autoSend) params.set('send', '1');
  }
  return `/chat?${params.toString()}`;
}

/** `/chat` without `?agent=` talks to the builder. */
export function resolveChatAgentName(agentParam: string | null | undefined): string {
  const name = agentParam?.trim();
  return name ? name : BUILDER_AGENT;
}

/** The directory's showcase: every agent except the builder. */
export function exampleAgents<T extends { name: string }>(agents: readonly T[]): T[] {
  return agents.filter((agent) => agent.name !== BUILDER_AGENT);
}
