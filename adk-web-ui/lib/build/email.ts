import type { Build } from './types';
import { enabledOptions, plural } from './summary';

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
 * Build name/description are steered by an anonymous visitor and the
 * recipient is any address they type, so URL-like text must not survive as
 * something a mail client would auto-link: the build link is the only URL.
 */
function defang(s: string): string {
  return s
    .replace(/\b[a-z][a-z0-9+.-]*:\/\//gi, (m) => m.replace('://', '[:]//'))
    .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b/gi, (m) => m.replace(/\./g, '[.]'));
}

/**
 * The link email. The only URL in it is `link`, and the site is named by
 * that link's host, so nothing deployment-specific is baked in.
 */
export function buildLinkEmail(build: Build, link: string): BuildLinkMessage {
  const site = new URL(link).host;
  const name = defang(build.name);
  const description = build.description ? defang(build.description) : '';
  const options = enabledOptions(build);
  const facts = [plural(build.files, 'file'), plural(build.tools.length, 'tool'), plural(build.skills.length, 'skill')]
    .concat(options)
    .join(' · ');
  // The artifact name is visitor-steered and `.zip` is a real TLD, so it never appears in the email.
  const steps = [
    'Unzip the download.',
    'Copy .env.example to .env and fill in the keys it lists.',
    'Follow README.md to run it locally and deploy it.',
  ];

  const lines = [`Here is the agent you built on ${site}: ${name}.`];
  if (description) lines.push('', description);
  lines.push('', facts, '', `Download it any time: ${link}`, PRIVATE_NOTE, '', 'Run it locally:');
  lines.push(...steps.map((s, i) => `${i + 1}. ${s}`));

  const html = [
    `<p>Here is the agent you built on ${escapeHtml(site)}: <strong>${escapeHtml(name)}</strong>.</p>`,
    description ? `<p>${escapeHtml(description)}</p>` : '',
    `<p>${escapeHtml(facts)}</p>`,
    `<p><a href="${escapeHtml(link)}">Download your agent</a></p>`,
    `<p>${escapeHtml(PRIVATE_NOTE)}</p>`,
    '<p>Run it locally:</p>',
    `<ol>${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject: `Your agent: ${name.replace(/\s+/g, ' ').trim()}`, html, text: lines.join('\n') + '\n' };
}
