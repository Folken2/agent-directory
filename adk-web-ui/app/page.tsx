'use client';

import Link from 'next/link';
import AgentGrid from '@/components/AgentGrid';
import { ArrowRight, Github } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero — left-aligned, restrained, generous whitespace.
          The serif italic carries the personal touch; everything else is calm. */}
      <section className="max-w-6xl mx-auto px-6 lg:px-8 pt-20 pb-16 sm:pt-28 sm:pb-24">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-md-on-surface-variant">
            <span className="h-1 w-1 rounded-full bg-md-primary" />
            Built on Google ADK · Gemini 3 Flash
          </span>

          <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-md-on-surface leading-[1.05]">
            A directory of <span className="font-serif-accent font-normal text-md-on-surface">agents</span>,
            <br className="hidden sm:block" /> ready to try.
          </h1>

          <p className="mt-6 text-base sm:text-lg text-md-on-surface-variant leading-relaxed max-w-[60ch]">
            Production-grade AI agents built on Google&rsquo;s Agent Development Kit.
            Browse the catalog, open one in chat, and read how it&rsquo;s built — all
            in the browser, no install required.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="#agents"
              className="group inline-flex items-center gap-2 px-5 h-11 rounded-full bg-md-primary text-md-on-primary text-sm font-medium tracking-tight hover:opacity-90 transition-opacity"
            >
              Browse agents
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <a
              href="https://github.com/Folken2/agent-directory"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 h-11 rounded-full bg-md-surface-container hover:bg-md-surface-container-high text-md-on-surface text-sm font-medium tracking-tight transition-colors"
            >
              <Github className="w-4 h-4" />
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Hairline divider — replaces the gradient transition */}
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="h-px bg-md-outline/60" />
      </div>

      {/* Agents */}
      <section id="agents" className="max-w-6xl mx-auto px-6 lg:px-8 py-16 sm:py-20">
        <header className="mb-10 flex items-end justify-between gap-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-md-on-surface">
              Available agents
            </h2>
            <p className="mt-1.5 text-sm text-md-on-surface-variant">
              Each agent is a self-contained ADK app with its own tools and prompts.
            </p>
          </div>
        </header>
        <AgentGrid />
      </section>
    </div>
  );
}
