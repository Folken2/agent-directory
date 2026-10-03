import type { Blueprint } from './types';

const bullet = (items: string[]) => items.map((i) => `- ${i}`).join('\n');

/** Plain Markdown export used by "Copy as Markdown" and the download. */
export function blueprintToMarkdown(bp: Blueprint): string {
  const out: string[] = [`# ${bp.name}`, '', bp.goal, ''];

  out.push('## Agents', '');
  for (const a of bp.agents) {
    const meta = [a.kind, a.model].filter(Boolean).join(', ');
    out.push(`### ${a.name} (${meta})`, '', a.role);
    if (a.tools.length) out.push('', `Tools: ${a.tools.join(', ')}`);
    if (a.subAgents.length) out.push('', `Sub-agents: ${a.subAgents.join(', ')}`);
    out.push('');
  }
  if (bp.tools.length) {
    out.push('## Tools', '', bullet(bp.tools.map((t) => `**${t.name}** (${t.kind}): ${t.purpose}`)), '');
  }
  if (bp.dataSources.length) {
    out.push(
      '## Data sources',
      '',
      bullet(bp.dataSources.map((d) => `**${d.name}**: ${d.purpose}${d.access ? ` (access: ${d.access})` : ''}`)),
      '',
    );
  }
  if (bp.models.length) {
    out.push(
      '## Models',
      '',
      bullet(bp.models.map((m) => `**${m.model}**${m.usedBy.length ? ` for ${m.usedBy.join(', ')}` : ''}: ${m.reason}`)),
      '',
    );
  }
  if (bp.risks.length) out.push('## Risks', '', bullet(bp.risks), '');
  if (bp.nextSteps.length) out.push('## Next steps', '', bp.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n'), '');
  if (bp.codeSkeleton) out.push('## Code skeleton', '', '```python', bp.codeSkeleton.trimEnd(), '```', '');
  return out.join('\n').trimEnd() + '\n';
}

/** Safe file name for the Markdown download. */
export function blueprintFileName(bp: Blueprint): string {
  const slug = bp.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'agent'}-blueprint.md`;
}
