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
    <footer className="border-t border-md-outline bg-md-surface-variant elevation-2">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-label-medium text-md-on-surface-variant flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>© {new Date().getFullYear()} ADK Agent Directory. Built with Google ADK.</span>
            <Link
              href="/privacy"
              className="underline underline-offset-2 hover:text-md-on-surface"
            >
              Privacy
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              prefetch={false}
              className="inline-flex items-center justify-center p-2.5 text-md-on-surface-variant hover:text-md-primary rounded-lg border border-md-outline hover:border-md-primary transition-all elevation-0 hover:elevation-1"
              aria-label="GitHub"
            >
              <Github className="w-4 h-4" />
            </Link>
            <Link
              href={linkedinUrl}
              target="_blank"
              rel="noreferrer"
              prefetch={false}
              className="inline-flex items-center justify-center p-2.5 text-md-on-surface-variant hover:text-md-primary rounded-lg border border-md-outline hover:border-md-primary transition-all elevation-0 hover:elevation-1"
              aria-label="LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </Link>
            <Link
              href={personalUrl}
              target="_blank"
              rel="noreferrer"
              prefetch={false}
              className="inline-flex items-center justify-center p-2.5 text-md-on-surface-variant hover:text-md-primary rounded-lg border border-md-outline hover:border-md-primary transition-all elevation-0 hover:elevation-1"
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

