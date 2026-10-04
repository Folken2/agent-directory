import type { Build } from './types';
import { enabledOptions, plural, runSteps } from './summary';

export type BuildLinkMessage = { subject: string; html: string; text: string };

const PRIVATE_NOTE =
  'Anyone with this link can download the build, so keep it to yourself. You can delete the build from that page.';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The link email. The only URL in it is `link`, and the site is named by
 * that link's host, so nothing deployment-specific is baked in.
 */
export function buildLinkEmail(build: Build, link: string): BuildLinkMessage {
  const site = new URL(link).host;
  const options = enabledOptions(build);
  const facts = [plural(build.files, 'file'), plural(build.tools.length, 'tool'), plural(build.skills.length, 'skill')]
    .concat(options)
    .join(' · ');
  const steps = runSteps(build.artifact);

  const lines = [`Here is the agent you built on ${site}: ${build.name}.`];
  if (build.description) lines.push('', build.description);
  lines.push('', facts, '', `Download it any time: ${link}`, PRIVATE_NOTE, '', 'Run it locally:');
  lines.push(...steps.map((s, i) => `${i + 1}. ${s}`));

  const html = [
    `<p>Here is the agent you built on ${escapeHtml(site)}: <strong>${escapeHtml(build.name)}</strong>.</p>`,
    build.description ? `<p>${escapeHtml(build.description)}</p>` : '',
    `<p>${escapeHtml(facts)}</p>`,
    `<p><a href="${escapeHtml(link)}">Download ${escapeHtml(build.artifact)}</a></p>`,
    `<p>${escapeHtml(PRIVATE_NOTE)}</p>`,
    '<p>Run it locally:</p>',
    `<ol>${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject: `Your agent: ${build.name}`, html, text: lines.join('\n') + '\n' };
}
