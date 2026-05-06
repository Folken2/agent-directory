'use client';

import Link from 'next/link';
import { Github, Linkedin, Globe2 } from 'lucide-react';

export default function Footer() {
  const normalizeUrl = (value: string | undefined, fallback: string) => {
    if (!value) return fallback;
    try {
      return new URL(value).toString();
    } catch {
      return fallback;
    }
  };

  const githubUrl = normalizeUrl(process.env.NEXT_PUBLIC_GITHUB_URL, 'https://github.com');
  const linkedinUrl = normalizeUrl(process.env.NEXT_PUBLIC_LINKEDIN_URL, 'https://www.linkedin.com');
  const personalUrl = normalizeUrl(process.env.NEXT_PUBLIC_PERSONAL_URL, 'https://example.com');

  return (
    <footer className="border-t border-md-outline/60 bg-background">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-baseline gap-1.5 text-sm text-md-on-surface-variant">
            <span suppressHydrationWarning>© {new Date().getFullYear()} Agent Directory</span>
            <span className="font-serif-accent text-[13px]">by folch.ai</span>
            <span className="hidden sm:inline text-md-on-surface-variant/60">·</span>
            <span className="hidden sm:inline text-md-on-surface-variant/80">Built on Google ADK</span>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              prefetch={false}
              className="inline-flex items-center justify-center w-9 h-9 rounded-full text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-container transition-colors"
              aria-label="GitHub"
            >
              <Github className="w-4 h-4" />
            </Link>
            <Link
              href={linkedinUrl}
              target="_blank"
              rel="noreferrer"
              prefetch={false}
              className="inline-flex items-center justify-center w-9 h-9 rounded-full text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-container transition-colors"
              aria-label="LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </Link>
            <Link
              href={personalUrl}
              target="_blank"
              rel="noreferrer"
              prefetch={false}
              className="inline-flex items-center justify-center w-9 h-9 rounded-full text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-container transition-colors"
              aria-label="Website"
            >
              <Globe2 className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
