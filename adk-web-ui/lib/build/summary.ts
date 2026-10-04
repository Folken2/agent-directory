import type { Build } from './types';

/** "with_slack" → "Slack", "persona" → "Persona". */
export function optionLabel(key: string): string {
  return key
    .replace(/^with_/, '')
    .split('_')
    .filter(Boolean)
    .map((w) => (w === 'acp' ? 'ACP' : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Labels of the nuvel options the build was scaffolded with, sorted. */
export function enabledOptions(build: Pick<Build, 'options'>): string[] {
  return Object.entries(build.options)
    .filter(([, on]) => on)
    .map(([key]) => optionLabel(key))
    .sort();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round((bytes / 1024) * 10) / 10} KB`;
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Steps that hold for every generated project; its README has the details. */
export function runSteps(artifact: string): string[] {
  return [
    `Unzip ${artifact}.`,
    'Copy .env.example to .env and fill in the keys it lists.',
    'Follow README.md to run it locally and deploy it.',
  ];
}

/** Plain summary for the owner notification. */
export function buildToMarkdown(build: Build): string {
  const out = [`# ${build.name}`, ''];
  if (build.description) out.push(build.description, '');
  out.push(`- Package: \`${build.package}\``);
  const options = enabledOptions(build);
  if (options.length) out.push(`- Options: ${options.join(', ')}`);
  out.push(`- Models: fast ${build.models.fast ?? 'default'}, reasoning ${build.models.reasoning ?? 'default'}`);
  if (build.tools.length) out.push(`- Tools: ${build.tools.join(', ')}`);
  if (build.skills.length) out.push(`- Skills: ${build.skills.join(', ')}`);
  out.push(`- Zip: ${build.artifact}, ${plural(build.files, 'file')}, ${formatBytes(build.bytes)}`);
  return out.join('\n') + '\n';
}

/** Download name for a stored zip: the project name, never a path or a quote. */
export function zipFileName(projectName: string): string {
  const stem = projectName
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `${stem || 'agent'}.zip`;
}

/** The existing single-artifact route (`/api/artifacts?artifact_name=&version=`). */
export function artifactDownloadUrl(
  appName: string,
  sessionId: string,
  build: Pick<Build, 'artifact' | 'version'>,
): string {
  const params = new URLSearchParams({
    app_name: appName,
    session_id: sessionId,
    artifact_name: build.artifact,
    version: String(build.version),
  });
  return `/api/artifacts?${params.toString()}`;
}
