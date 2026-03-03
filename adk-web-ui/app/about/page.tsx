'use client';

import Link from 'next/link';
import { ArrowRight, Github, Code, Zap, Users, BookOpen } from 'lucide-react';

export default function AboutPage() {
  const features = [
    {
      icon: Zap,
      title: 'Powerful Agents',
      description: 'Each agent is designed with specific tools and capabilities to accomplish tasks efficiently.',
    },
    {
      icon: Code,
      title: 'Open Source',
      description: 'Built on Google ADK and open-source technologies. Contribute and improve the ecosystem.',
    },
    {
      icon: Users,
      title: 'Community Driven',
      description: 'Discover agents created by the community and share your own creations.',
    },
    {
      icon: BookOpen,
      title: 'Well Documented',
      description: 'Every agent includes documentation, use cases, and sample prompts.',
    },
  ];

  return (
    <div className="min-h-screen bg-md-surface pt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-display-small text-md-on-surface mb-4">
            About ADK Agent Directory
          </h1>
          <p className="text-body-large text-md-on-surface-variant max-w-2xl mx-auto">
            A directory of intelligent AI agents powered by Google Gemini 2.5 Flash. Discover, use, and contribute agents for various use cases.
          </p>
        </div>

        {/* What is Agent Directory */}
        <div className="mb-12">
          <h2 className="text-headline-medium text-md-on-surface mb-4">
            What is ADK Agent Directory?
          </h2>
          <p className="text-body-medium text-md-on-surface-variant leading-relaxed mb-4">
            ADK Agent Directory is a curated directory of AI agents built with Google's Agent Development Kit (ADK).
            Each agent is designed to solve specific problems using specialized tools and capabilities.
          </p>
          <p className="text-body-medium text-md-on-surface-variant leading-relaxed">
            Whether you're looking for an agent to help with web search, image generation, document processing,
            or any other task, ADK Agent Directory makes it easy to discover and use the right agent for your needs.
          </p>
        </div>

        {/* Features */}
        <div className="mb-12">
          <h2 className="text-headline-medium text-md-on-surface mb-6">
            Features
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="bg-md-surface elevation-1 hover:elevation-2 rounded-xl p-6 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-md-primary-container rounded-lg">
                      <Icon className="w-5 h-5 text-md-on-primary-container" />
                    </div>
                    <h3 className="text-title-medium text-md-on-surface">{feature.title}</h3>
                  </div>
                  <p className="text-body-small text-md-on-surface-variant">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* How Agents Work */}
        <div className="mb-12 bg-md-surface-container elevation-1 rounded-2xl p-8">
          <h2 className="text-headline-medium text-md-on-surface mb-4">
            How Agents Work
          </h2>
          <p className="text-body-medium text-md-on-surface-variant leading-relaxed mb-4">
            Agents in ADK Agent Directory are built using Google's Agent Development Kit (ADK), which provides:
          </p>
          <ul className="space-y-2 text-body-medium text-md-on-surface-variant list-disc list-inside">
            <li>Integration with Google Gemini 2.5 Flash for natural language understanding</li>
            <li>Tool calling capabilities for interacting with external services</li>
            <li>Session management for maintaining conversation context</li>
            <li>Artifact handling for generating and managing outputs</li>
            <li>Sub-agent coordination for complex workflows</li>
          </ul>
        </div>

        {/* Technology Stack */}
        <div className="mb-12">
          <h2 className="text-headline-medium text-md-on-surface mb-6">
            Technology Stack
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-md-surface-variant/50 rounded-xl p-6 border border-md-outline">
              <h3 className="text-title-medium text-md-on-surface mb-3">Backend</h3>
              <ul className="text-body-small text-md-on-surface-variant space-y-1.5">
                <li>• Google ADK (Agent Development Kit)</li>
                <li>• Python</li>
                <li>• FastAPI</li>
                <li>• PostgreSQL / Neon</li>
              </ul>
            </div>
            <div className="bg-md-surface-variant/50 rounded-xl p-6 border border-md-outline">
              <h3 className="text-title-medium text-md-on-surface mb-3">Frontend</h3>
              <ul className="text-body-small text-md-on-surface-variant space-y-1.5">
                <li>• Next.js 16</li>
                <li>• React 19</li>
                <li>• TypeScript</li>
                <li>• Tailwind CSS v4</li>
                <li>• Material Design 3</li>
              </ul>
            </div>
          </div>
        </div>

        {/* How to Contribute */}
        <div className="mb-12 bg-md-primary-container/30 rounded-2xl border border-md-primary/20 p-8">
          <h2 className="text-headline-medium text-md-on-surface mb-4">
            How to Contribute
          </h2>
          <p className="text-body-medium text-md-on-surface-variant leading-relaxed mb-6">
            We welcome contributions! Whether you want to add a new agent, improve existing ones,
            or enhance the platform, your contributions are valuable.
          </p>
          <Link
            href="/contribute"
            className="inline-flex items-center gap-2 px-6 py-3 bg-md-primary hover:bg-md-primary/92 text-md-on-primary rounded-full text-label-large transition-all elevation-1 hover:elevation-2"
          >
            Learn How to Contribute
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Contact */}
        <div className="text-center">
          <h2 className="text-headline-medium text-md-on-surface mb-4">
            Get in Touch
          </h2>
          <p className="text-body-medium text-md-on-surface-variant mb-6">
            Have questions or suggestions? Reach out through GitHub or contribute directly to the project.
          </p>
          <a
            href="https://github.com/Folken2/agent-directory"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-md-surface-container hover:bg-md-surface-variant rounded-xl border border-md-outline text-label-large transition-all elevation-1 hover:elevation-2"
          >
            <Github className="w-5 h-5" />
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
