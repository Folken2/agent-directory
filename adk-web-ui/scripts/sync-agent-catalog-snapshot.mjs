#!/usr/bin/env node
/**
 * Rebuild lib/agent-catalog.snapshot.json from agents/<name>/metadata.json.
 * Run from repo root or adk-web-ui after adding/removing agents.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uiRoot = join(__dirname, '..');
const repoRoot = join(uiRoot, '..');
const agentsDir = join(repoRoot, 'agents');
const dest = join(uiRoot, 'lib', 'agent-catalog.snapshot.json');

if (!existsSync(agentsDir)) {
  console.error(`Agents directory not found: ${agentsDir}`);
  process.exit(1);
}

const agents = [];
for (const name of readdirSync(agentsDir).sort()) {
  const metaPath = join(agentsDir, name, 'metadata.json');
  if (!existsSync(metaPath)) continue;
  const m = JSON.parse(readFileSync(metaPath, 'utf8'));
  agents.push({
    name,
    displayName: m.displayName || m.display_name || name,
    description: m.description || '',
    tools: Array.isArray(m.tools) ? m.tools : [],
    tags: Array.isArray(m.tags) ? m.tags : [],
    useCases: Array.isArray(m.useCases) ? m.useCases : m.use_cases || [],
    samplePrompts: Array.isArray(m.samplePrompts)
      ? m.samplePrompts
      : m.sample_prompts || [],
    author: m.author || undefined,
    category: m.category || undefined,
    logo: m.logo || undefined,
    githubUrl: m.githubUrl || m.github_url || undefined,
    finalSubAgent: m.finalSubAgent || m.final_sub_agent || undefined,
  });
}

const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  agents,
};

writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote ${agents.length} agents to ${dest}`);
