'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import AgentGrid from '@/components/AgentGrid';
import DirectoryPulse from '@/components/analytics/DirectoryPulse';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  const { data: session, status } = useSession();
  const signedIn = status === 'authenticated' && !!session?.user;

  const handleCTAClick = () => {
    document.getElementById('agents-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-md-surface via-md-surface-container-low/50 to-md-surface-container-low pt-16">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="text-center max-w-4xl mx-auto relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-md-primary/5 rounded-full blur-3xl -z-10" />

          <div className="flex justify-center mb-5">
            <DirectoryPulse />
          </div>
          <h2 className="text-display-medium sm:text-display-large font-bold text-md-on-surface mb-6 tracking-tight">
            Discover Google AI Agents
          </h2>
          <p className="text-body-large sm:text-headline-small text-md-on-surface-variant/80 mb-10 leading-relaxed max-w-2xl mx-auto font-light">
            A free, open-source directory of specialized agents built with Google ADK.
            Try any agent now — or sign in to unlock richer experiences.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <button
              onClick={handleCTAClick}
              className="px-8 py-4 bg-md-primary hover:bg-md-primary/90 text-md-on-primary rounded-full text-label-large font-semibold transition-all duration-300 shadow-lg shadow-md-primary/25 hover:shadow-xl hover:shadow-md-primary/30 hover:-translate-y-0.5 flex items-center gap-2 group"
            >
              Try free agents
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            {signedIn ? (
              <Link
                href="/me/sessions"
                className="px-8 py-4 bg-md-surface border border-md-outline hover:bg-md-surface-container-low text-md-on-surface rounded-full text-label-large font-medium transition-all duration-300 hover:border-md-outline-variant hover:-translate-y-0.5"
              >
                Your sessions
              </Link>
            ) : (
              <Link
                href="/auth/signin"
                className="px-8 py-4 bg-md-surface border border-md-outline hover:bg-md-surface-container-low text-md-on-surface rounded-full text-label-large font-medium transition-all duration-300 hover:border-md-outline-variant hover:-translate-y-0.5"
              >
                Sign in for more
              </Link>
            )}
          </div>

          {!signedIn && (
            <p className="text-sm text-md-on-surface-variant/75 max-w-xl mx-auto mb-10 leading-relaxed">
              Sign in to unlock bring your own keys (BYOK), connect Gmail and other MCPs
              for better agent experiences, plus higher limits and saved chat history.
              Agents stay free to try without an account.
            </p>
          )}

          <a
            href="https://github.com/Folken2/agent-directory"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-md-on-surface-variant/70 hover:text-md-on-surface underline-offset-4 hover:underline"
          >
            View repository
          </a>
        </div>
      </section>

      <section id="agents-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <div className="flex items-center justify-between mb-10">
          <h3 className="text-headline-small text-md-on-surface font-semibold tracking-tight">
            Available Agents
          </h3>
        </div>
        <AgentGrid />
      </section>
    </div>
  );
}
