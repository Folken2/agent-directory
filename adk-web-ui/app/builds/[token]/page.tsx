import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isDbEnabled } from '@/lib/db';
import { findBuildSave } from '@/lib/build/db-store';
import { parseBuild } from '@/lib/build/parse';
import { enabledOptions, formatBytes, plural, runSteps, zipFileName } from '@/lib/build/summary';
import { hashBuildToken, isBuildToken } from '@/lib/build/token';
import { cn } from '@/lib/utils';
import { Page, PageHeader } from '@/components/layout/Page';
import { panelClass } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import BuildLinkActions from '@/components/build/BuildLinkActions';

export const dynamic = 'force-dynamic';

// The token is a secret: keep the page out of search engines and referrers
// (next.config.ts also sends X-Robots-Tag and Referrer-Policy headers).
export const metadata: Metadata = {
  title: 'Your build | ADK Agent Directory',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

type Params = Promise<{ token: string }>;

export default async function BuildLinkPage({ params }: { params: Params }) {
  const { token } = await params;
  // Malformed, unknown and unconfigured all look the same: a plain 404.
  if (!isBuildToken(token) || !isDbEnabled()) notFound();
  const save = await findBuildSave(hashBuildToken(token));
  if (!save) notFound();

  if (save.deletedAt) {
    return (
      <Page>
        <PageHeader
          title="Build deleted"
          description="This build, its zip and the email address it was sent to have been deleted. The link no longer works."
        />
      </Page>
    );
  }

  const build = parseBuild(save.build);
  const fileName = zipFileName(save.projectName);
  const options = build ? enabledOptions(build) : [];
  const models = build ? [build.models.fast, build.models.reasoning].filter((m): m is string => Boolean(m)) : [];

  return (
    <Page>
      <PageHeader title={build?.name ?? save.projectName} description={build?.description || 'An agent you built with the agent builder.'} />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className={cn(panelClass, 'space-y-6 p-6')}>
          <div className="space-y-3">
            <h2 className="text-title-medium text-md-on-surface">What&apos;s in it</h2>
            {options.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {options.map((o) => (
                  <Chip key={o} variant="category">
                    {o}
                  </Chip>
                ))}
              </div>
            ) : null}
            {models.length > 0 ? (
              <p className="break-all text-body-medium text-md-on-surface-variant">Models: {models.join(' · ')}</p>
            ) : null}
            {build ? (
              <p className="text-body-medium text-md-on-surface-variant">
                {plural(build.files, 'file')} · {plural(build.tools.length, 'tool')} · {plural(build.skills.length, 'skill')} ·{' '}
                {formatBytes(save.zipBytes)}
              </p>
            ) : (
              <p className="text-body-medium text-md-on-surface-variant">{formatBytes(save.zipBytes)}</p>
            )}
          </div>
          <div className="space-y-3">
            <h2 className="text-title-medium text-md-on-surface">Run it locally</h2>
            <ol className="list-decimal space-y-1 pl-5 text-body-medium text-md-on-surface-variant">
              {runSteps(fileName).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </section>
        <aside className={cn(panelClass, 'p-6')}>
          <BuildLinkActions token={token} fileName={fileName} />
        </aside>
      </div>
    </Page>
  );
}
