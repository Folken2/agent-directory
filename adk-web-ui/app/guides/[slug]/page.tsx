import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Page, PageHeader } from '@/components/layout/Page';
import BuildCta from '@/components/story/BuildCta';
import GuideBody from '@/components/guides/GuideBody';
import TryItLive from '@/components/guides/TryItLive';
import ContactCta from '@/components/guides/ContactCta';
import CopyPageButton from '@/components/guides/CopyPageButton';
import { getGuide, guideHeadings, guideMarkdown, guideMarkdownPath, guidePath, loadGuides } from '@/lib/guides';
import { guideJsonLd, jsonLdScript, SITE_NAME, SITE_OWNER, siteUrl } from '@/lib/seo';

type Params = Promise<{ slug: string }>;

// Guides are files in content/guides, so an unknown slug is a plain 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return loadGuides().map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: `Guide not found | ${SITE_NAME}` };

  const url = guidePath(guide.slug);
  return {
    title: { absolute: guide.seoTitle },
    description: guide.description,
    keywords: guide.keywords,
    authors: [{ name: SITE_OWNER }],
    alternates: { canonical: url, types: { 'text/markdown': guideMarkdownPath(guide.slug) } },
    openGraph: {
      type: 'article',
      url,
      siteName: SITE_NAME,
      title: guide.seoTitle,
      description: guide.description,
      publishedTime: guide.published,
      modifiedTime: guide.updated ?? guide.published,
      authors: [SITE_OWNER],
    },
    twitter: { card: 'summary_large_image', title: guide.seoTitle, description: guide.description },
  };
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function GuidePage({ params }: { params: Params }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const headings = guideHeadings(guide.body);
  const updated = guide.updated && guide.updated !== guide.published ? guide.updated : null;

  return (
    <Page>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(guideJsonLd(guide, siteUrl())) }}
      />
      <PageHeader
        breadcrumbs={[{ label: 'Guides', href: '/guides' }, { label: guide.title }]}
        title={guide.title}
        description={
          <>
            <p>{guide.description}</p>
            <p className="mt-3 text-body-medium">
              By {SITE_OWNER} · <time dateTime={guide.published}>{formatDate(guide.published)}</time>
              {updated ? (
                <>
                  {' · Updated '}
                  <time dateTime={updated}>{formatDate(updated)}</time>
                </>
              ) : null}
            </p>
            <div className="mt-5">
              <CopyPageButton
                markdown={guideMarkdown(guide, siteUrl(), SITE_OWNER)}
                slug={guide.slug}
                markdownHref={guideMarkdownPath(guide.slug)}
              />
            </div>
          </>
        }
      />

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="min-w-0 max-w-3xl">
          {/* On small screens the live demo comes before the article, not after it. */}
          <TryItLive agents={guide.agents} className="mb-10 lg:hidden" />
          <GuideBody markdown={guide.body} />
          <ContactCta />
        </article>

        <aside aria-label="Guide" className="hidden lg:block">
          <div className="space-y-6 lg:sticky lg:top-24">
            <TryItLive agents={guide.agents} />
            {headings.length > 0 ? (
              <nav aria-label="On this page" className="px-1">
                <h2 className="text-label-large text-md-on-surface-variant">On this page</h2>
                <ul className="mt-3 space-y-2 border-l border-md-outline/60 text-body-medium">
                  {headings.map((heading) => (
                    <li key={heading.id}>
                      <a
                        href={`#${heading.id}`}
                        className="-ml-px block border-l border-transparent pl-4 text-md-on-surface-variant transition-colors hover:border-md-primary hover:text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
                      >
                        {heading.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </div>
        </aside>
      </div>

      <BuildCta />
    </Page>
  );
}
