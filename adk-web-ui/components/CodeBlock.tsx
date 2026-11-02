'use client';

import { useState } from 'react';
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
import { useDarkMode } from '@/lib/hooks/useDarkMode';

const LANGS = { python, typescript, tsx, javascript, jsx, json, bash, yaml, sql, markdown, diff, toml };
for (const [name, def] of Object.entries(LANGS)) PrismLight.registerLanguage(name, def);

/**
 * Highlighted code with a language label and a copy button. Shared by chat
 * messages and guides so code looks the same everywhere on the site.
 */
export default function CodeBlock({
  code,
  language: rawLanguage,
  isDarkMode,
}: {
  code: string;
  /** Fence info string, e.g. "py"; unknown languages render as plain text. */
  language?: string;
  /** Defaults to the site theme. */
  isDarkMode?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const siteDark = useDarkMode();
  const dark = isDarkMode ?? siteDark;
  const language = normalizeLanguage(rawLanguage);

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      <div className="relative rounded-lg overflow-hidden border border-md-outline/50 bg-[hsl(var(--md-surface-container-high))]">
        {code && (
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
          style={dark ? oneDark : oneLight}
          customStyle={{ margin: 0, padding: '1rem', fontSize: '0.875rem', lineHeight: '1.6', background: 'transparent' }}
          PreTag="div"
          showLineNumbers={false}
          codeTagProps={{ style: { background: 'transparent' } }}
        >
          {code}
        </PrismLight>
      </div>
    </div>
  );
}
