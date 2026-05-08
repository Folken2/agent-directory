'use client';

import Image from 'next/image';
import Link from 'next/link';
import AgentGrid from '@/components/AgentGrid';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  const handleCTAClick = () => {
    // Scroll to agents section
    const agentsSection = document.getElementById('agents-section');
    if (agentsSection) {
      agentsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-md-surface via-md-surface-container-low/50 to-md-surface-container-low pt-16">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="text-center max-w-4xl mx-auto relative">
          {/* Decorative blur */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-md-primary/5 rounded-full blur-3xl -z-10" />

          <h2 className="text-display-medium sm:text-display-large font-bold text-md-on-surface mb-6 tracking-tight">
            Discover Google AI Agents
          </h2>
          <p className="text-body-large sm:text-headline-small text-md-on-surface-variant/80 mb-10 leading-relaxed max-w-2xl mx-auto font-light">
            Explore our collection of specialized Google Agents. All agents are built with the Agent Development Kit (ADK) and powered by Gemini, each designed with specific tools and capabilities to help you accomplish your goals efficiently.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={handleCTAClick}
              className="px-8 py-4 bg-md-primary hover:bg-md-primary/90 text-md-on-primary rounded-full text-label-large font-semibold transition-all duration-300 shadow-lg shadow-md-primary/25 hover:shadow-xl hover:shadow-md-primary/30 hover:-translate-y-0.5 flex items-center gap-2 group"
            >
              Browse Agents
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <a href="https://github.com/Folken2/agent-directory" target="_blank" rel="noopener noreferrer" className="px-8 py-4 bg-md-surface border border-md-outline hover:bg-md-surface-container-low text-md-on-surface rounded-full text-label-large font-medium transition-all duration-300 hover:border-md-outline-variant hover:-translate-y-0.5">
              View Repository
            </a>
          </div>

          <p className="text-label-small text-md-on-surface-variant/60 uppercase tracking-widest">
            Powered by Google Gemini 3 Flash
          </p>
        </div>
      </section>

      {/* Agents Section */}
      <section id="agents-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <div className="flex items-center justify-between mb-10">
          <h3 className="text-headline-small text-md-on-surface font-semibold tracking-tight">Available Agents</h3>
          {/* <div className="h-px bg-md-outline/30 flex-1 ml-6"></div> */}
        </div>
        <AgentGrid />
      </section>
    </div>
  );
}
