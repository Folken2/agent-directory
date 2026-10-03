'use client';

import React, { useMemo, useState } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dynamic from 'next/dynamic';
import { PrismLight } from 'react-syntax-highlighter';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff';
import toml from 'react-syntax-highlighter/dist/esm/languages/prism/toml';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import { normalizeLanguage } from '@/lib/code-languages';

const LANGS = { python, typescript, tsx, javascript, jsx, json, bash, yaml, sql, markdown, diff, toml };
for (const [name, def] of Object.entries(LANGS)) PrismLight.registerLanguage(name, def);

const MermaidDiagram = dynamic(() => import('../MermaidDiagram'), {
  ssr: false,
  loading: () => <div className="h-32 rounded-2xl bg-md-surface-container animate-pulse" />,
});

function extractCodeString(children: any): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) {
    return children.map(extractCodeString).filter(Boolean).join('');
  }
  if (children && typeof children === 'object' && 'props' in children) {
    if (children.props?.children !== undefined) {
      return extractCodeString(children.props.children);
    }
  }
  return '';
}

function CodeBlock({ children, isStreaming, isDarkMode }: { children: any; isStreaming: boolean; isDarkMode: boolean }) {
  const [copied, setCopied] = useState(false);

  const codeElement = Array.isArray(children) ? children[0] : children;
  const codeClassName = codeElement?.props?.className || '';
  const isMermaid = codeClassName.includes('language-mermaid');

  if (isMermaid) {
    let codeString = '';
    if (codeElement?.props?.children) {
      const c = codeElement.props.children;
      if (typeof c === 'string') {
        codeString = c;
      } else if (Array.isArray(c)) {
        codeString = c
          .map((child: any) => {
            if (typeof child === 'string') return child;
            if (child?.props?.children) {
              const cc = child.props.children;
              if (typeof cc === 'string') return cc;
              if (Array.isArray(cc)) return cc.map((x: any) => (typeof x === 'string' ? x : '')).join('');
            }
            return '';
          })
          .join('\n');
      }
    } else {
      codeString = extractCodeString(codeElement);
    }
    codeString = codeString.trim();
    if (codeString) {
      if (isStreaming) {
        return (
          <div className="my-4 p-4 rounded-lg border border-md-outline bg-md-surface text-md-on-surface">
            <div className="flex items-center gap-2 text-sm text-md-on-surface-variant">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Generating diagram&hellip;</span>
            </div>
          </div>
        );
      }
      return <MermaidDiagram code={codeString} />;
    }
  }

  const codeString = extractCodeString(children).trim();
  const match = codeClassName.match(/language-(\w+)/);
  const language = normalizeLanguage(match?.[1]);

  const handleCopy = () => {
    if (!codeString) return;
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const showHeader = !!codeString;

  return (
    <div className="relative group my-4">
      <div className="relative rounded-lg overflow-hidden border border-md-outline/50 bg-[hsl(var(--md-surface-container-high))]">
        {showHeader && (
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-md-outline/40 bg-md-surface-container/30">
            <span className="text-[10px] font-mono uppercase tracking-wider text-md-on-surface-variant/80">
              {language ?? 'plain text'}
            </span>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-[11px] text-md-on-surface-variant hover:text-md-on-surface transition-colors px-1.5 py-0.5 rounded opacity-60 group-hover:opacity-100"
              title="Copy code"
              aria-label="Copy code"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        )}
        <PrismLight
          language={language ?? 'text'}
          style={isDarkMode ? oneDark : oneLight}
          customStyle={{ margin: 0, padding: '1rem', fontSize: '0.875rem', lineHeight: '1.6', background: 'transparent' }}
          PreTag="div"
          showLineNumbers={false}
          codeTagProps={{ style: { background: 'transparent' } }}
        >
          {codeString}
        </PrismLight>
      </div>
    </div>
  );
}

export function useMarkdownComponents(isStreaming: boolean, isDarkMode: boolean): Components {
  return useMemo<Components>(
    () => ({
      pre: (props: any) => <CodeBlock isStreaming={isStreaming} isDarkMode={isDarkMode} {...props} />,
      code: ({ className, children, ...props }: any) => (
        <code className={`inline-code ${className || ''}`} {...props}>
          {children}
        </code>
      ),
      a: ({ href, children, ...props }: any) => (
        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      ),
    }),
    [isStreaming, isDarkMode],
  );
}

export function MarkdownRenderer({
  content,
  isStreaming,
  isDarkMode,
  className,
}: {
  content: string;
  isStreaming: boolean;
  isDarkMode: boolean;
  className?: string;
}) {
  const components = useMarkdownComponents(isStreaming, isDarkMode);
  return (
    <div className={className ?? 'markdown-content'}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
