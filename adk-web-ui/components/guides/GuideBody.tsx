import Link from 'next/link';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from '@/components/CodeBlock';
import { proseLink } from '@/components/ProsePage';
import { headingId } from '@/lib/guides';

function textOf(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return textOf((node.props as { children?: React.ReactNode }).children);
  }
  return '';
}

const inlineCode =
  'rounded-[var(--md-shape-sm)] bg-md-surface-container px-1.5 py-0.5 font-mono text-[0.875em] text-md-on-surface dark:bg-md-surface-container-high';

const components: Components = {
  h2: ({ children }) => (
    <h2 id={headingId(textOf(children))} className="mt-14 scroll-mt-24 text-headline-small tracking-tight text-md-on-surface first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 id={headingId(textOf(children))} className="mt-8 scroll-mt-24 text-title-large text-md-on-surface">
      {children}
    </h3>
  ),
  p: ({ children }) => <p className="mt-4">{children}</p>,
  ul: ({ children }) => <ul className="mt-4 list-disc space-y-2 pl-6 marker:text-md-on-surface-variant">{children}</ul>,
  ol: ({ children }) => <ol className="mt-4 list-decimal space-y-2 pl-6 marker:text-md-on-surface-variant">{children}</ol>,
  strong: ({ children }) => <strong className="font-medium text-md-on-surface">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="mt-6 rounded-[var(--md-shape-md)] border-l-4 border-md-primary bg-md-surface-container px-5 py-1 pb-4 dark:bg-md-surface-container-high">
      {children}
    </blockquote>
  ),
  a: ({ href = '', children }) =>
    href.startsWith('/') || href.startsWith('#') ? (
      <Link href={href} className={proseLink}>{children}</Link>
    ) : (
      <a href={href} target="_blank" rel="noreferrer" className={proseLink}>{children}</a>
    ),
  table: ({ children }) => (
    <div className="mt-6 overflow-x-auto rounded-[var(--md-shape-md)] border border-md-outline/60">
      <table className="w-full border-collapse text-left text-body-medium">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-md-outline/60 bg-md-surface-container px-4 py-2.5 font-medium text-md-on-surface dark:bg-md-surface-container-high">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-b border-md-outline/40 px-4 py-2.5 align-top">{children}</td>,
  // Fenced blocks arrive as <pre><code class="language-x">; inline code has no <pre>.
  pre: ({ children }) => {
    const code = Array.isArray(children) ? children[0] : children;
    const props = (code as { props?: { className?: string; children?: React.ReactNode } })?.props;
    const language = props?.className?.match(/language-(\w+)/)?.[1];
    return <CodeBlock code={textOf(props?.children).replace(/\n$/, '')} language={language} />;
  },
  code: ({ children }) => <code className={inlineCode}>{children}</code>,
};

/** A guide's Markdown body, rendered on the server; only code blocks hydrate. */
export default function GuideBody({ markdown }: { markdown: string }) {
  return (
    <div className="text-body-large text-md-on-surface-variant [&_li>p]:mt-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
