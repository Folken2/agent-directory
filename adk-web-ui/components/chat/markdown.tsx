'use client';

import React, { useMemo, useState } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import MermaidDiagram from '../MermaidDiagram';

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
          <div className="my-4 p-4 rounded-lg border border-border bg-card text-card-foreground">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
  const language = match ? match[1] : 'text';

  const handleCopy = () => {
    if (!codeString) return;
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      <div className="relative rounded-lg overflow-hidden border border-border bg-[hsl(var(--md-surface-container-high))]">
        <Prism
          language={language}
          style={isDarkMode ? oneDark : oneLight}
          customStyle={{ margin: 0, padding: '1rem', fontSize: '0.875rem', lineHeight: '1.6', background: 'transparent' }}
          PreTag="div"
          showLineNumbers={false}
          codeTagProps={{ style: { background: 'transparent' } }}
        >
          {codeString}
        </Prism>
        {codeString && (
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/90 hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity z-10 backdrop-blur-sm"
            title="Copy code"
            aria-label="Copy code"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
        )}
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
