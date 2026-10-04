/**
 * `state["builder:build"]`, written by the builder's package_agent tool
 * (agents/adk_agent_builder/tools/project_tools.py) after each packaging.
 * Each repackage overwrites it.
 */
export const BUILD_STATE_KEY = 'builder:build';

export type BuildModels = { fast: string | null; reasoning: string | null };

export type Build = {
  name: string;
  package: string;
  description: string;
  /** scaffold_agent's option params (with_slack, persona, ...). */
  options: Record<string, boolean>;
  models: BuildModels;
  tools: string[];
  skills: string[];
  /** Artifact name in the ADK session, e.g. "research-summarizer.zip". */
  artifact: string;
  version: number;
  files: number;
  bytes: number;
  packagedAt: string;
};

/** The caller's own ADK session, read server side by POST /api/builds. */
export type SessionBuildLookup = { kind: 'ok'; build: Build } | { kind: 'missing' } | { kind: 'unavailable' };

/** The zip artifact; `gone` means the in-memory artifact service lost it (restart). */
export type ZipLookup = { kind: 'ok'; bytes: Buffer } | { kind: 'gone' } | { kind: 'unavailable' };

/** One `build_saves` insert. */
export type NewBuildSave = {
  tokenHash: string;
  email: string;
  userId: string | null;
  sessionId: string;
  build: Build;
  zip: Buffer;
  updatesConsentAt: Date | null;
  helpRequested: boolean;
};
