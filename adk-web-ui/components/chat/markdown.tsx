'use client';

import React, { useMemo } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dynamic from 'next/dynamic';
import CodeBlockView from '../CodeBlock';

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
  const language = codeClassName.match(/language-(\w+)/)?.[1];
  return <CodeBlockView code={codeString} language={language} isDarkMode={isDarkMode} />;
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
