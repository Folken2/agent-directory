/** Mirrors agents/adk_agent_builder/blueprint.py (camelCase on the wire). */
export type BlueprintAgentKind = 'llm' | 'sequential' | 'parallel' | 'loop' | 'custom';
export type BlueprintToolKind = 'builtin' | 'function' | 'mcp' | 'openapi' | 'agent' | 'other';

export interface BlueprintAgent {
  name: string;
  role: string;
  kind: BlueprintAgentKind;
  model?: string;
  tools: string[];
  subAgents: string[];
}

export interface BlueprintTool {
  name: string;
  kind: BlueprintToolKind;
  purpose: string;
}

export interface BlueprintDataSource {
  name: string;
  purpose: string;
  access?: string;
}

export interface BlueprintModelChoice {
  model: string;
  usedBy: string[];
  reason: string;
}

export interface Blueprint {
  name: string;
  goal: string;
  agents: BlueprintAgent[];
  tools: BlueprintTool[];
  dataSources: BlueprintDataSource[];
  models: BlueprintModelChoice[];
  risks: string[];
  nextSteps: string[];
  codeSkeleton?: string;
}
