'use client';

import { NOT_AFFILIATED_NOTICE } from '@/lib/site';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Github, Code, Blocks, LayoutGrid, BookOpen } from 'lucide-react';

export default function AboutPage() {
  const features = [
    {
      icon: Blocks,
      title: 'Agent builder',
      description: 'Describe the agent you want. The builder helps you choose an architecture, tools and prompts, and drafts the code.',
    },
    {
      icon: LayoutGrid,
      title: 'Working examples',
      description: 'Try complete agents for research, data analysis, diagrams and more, free in the browser.',
    },
    {
      icon: Code,
      title: 'Open source',
      description: 'Every agent and the site itself are open source, so you can read how they are built and reuse the patterns.',
    },
    {
      icon: BookOpen,
      title: 'Documented',
      description: 'Each example lists its tools, use cases and sample prompts.',
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
            Design your own AI agent with an agent builder, and learn from working examples built with
            Google&apos;s Agent Development Kit (ADK).
          </p>
          <p className="text-body-medium text-md-on-surface-variant max-w-2xl mx-auto mt-4">
            {NOT_AFFILIATED_NOTICE}
          </p>
        </div>

        {/* What is Agent Directory */}
        <div className="mb-12">
          <h2 className="text-headline-medium text-md-on-surface mb-4">
            What is ADK Agent Directory?
          </h2>
          <p className="text-body-medium text-md-on-surface-variant leading-relaxed mb-4">
            Start by describing the agent you have in mind. The{' '}
            <Link href="/" className="text-md-primary underline-offset-4 hover:underline">agent builder</Link>{' '}
            asks about your goal, then proposes a design: which agents to use and how they work together,
            the tools and data they need, and code to get started.
          </p>
          <p className="text-body-medium text-md-on-surface-variant leading-relaxed">
            The{' '}
            <Link href="/examples" className="text-md-primary underline-offset-4 hover:underline">examples</Link>{' '}
            show what finished agents look like: web research, data analysis, image generation, diagrams,
            repository exploration and more. Each one is built with the Agent Development Kit and its source is
            on GitHub.
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
                <Card key={feature.title} variant="outlined" className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-md-primary-container rounded-[var(--md-shape-md)]">
                      <Icon className="w-5 h-5 text-md-on-primary-container" />
                    </div>
                    <h3 className="text-title-medium text-md-on-surface">{feature.title}</h3>
                  </div>
                  <p className="text-body-small text-md-on-surface-variant">{feature.description}</p>
                </Card>
              );
            })}
          </div>
        </div>

        {/* How Agents Work */}
        <Card variant="filled" className="mb-12 p-8">
          <h2 className="text-headline-medium text-md-on-surface mb-4">
            How Agents Work
          </h2>
          <p className="text-body-medium text-md-on-surface-variant leading-relaxed mb-4">
            The agents here are built with Google&apos;s Agent Development Kit (ADK), an open-source framework that provides:
          </p>
          <ul className="space-y-2 text-body-medium text-md-on-surface-variant list-disc list-inside">
            <li>Model integration, with Gemini models by default</li>
            <li>Tool calling capabilities for interacting with external services</li>
            <li>Session management for maintaining conversation context</li>
            <li>Artifact handling for generating and managing outputs</li>
            <li>Sub-agent coordination for complex workflows</li>
          </ul>
        </Card>

        {/* Technology Stack */}
        <div className="mb-12">
          <h2 className="text-headline-medium text-md-on-surface mb-6">
            Technology Stack
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Card variant="outlined" className="p-6">
              <h3 className="text-title-medium text-md-on-surface mb-3">Backend</h3>
              <ul className="text-body-small text-md-on-surface-variant space-y-1.5">
                <li>• Google ADK (Agent Development Kit)</li>
                <li>• Python</li>
                <li>• FastAPI</li>
                <li>• PostgreSQL / Neon</li>
              </ul>
            </Card>
            <Card variant="outlined" className="p-6">
              <h3 className="text-title-medium text-md-on-surface mb-3">Frontend</h3>
              <ul className="text-body-small text-md-on-surface-variant space-y-1.5">
                <li>• Next.js 16</li>
                <li>• React 19</li>
                <li>• TypeScript</li>
                <li>• Tailwind CSS v4</li>
                <li>• Material Design 3</li>
              </ul>
            </Card>
          </div>
        </div>

        {/* How to Contribute */}
        <Card variant="filled" className="mb-12 bg-md-primary-container/40 p-8">
          <h2 className="text-headline-medium text-md-on-surface mb-4">
            How to Contribute
          </h2>
          <p className="text-body-medium text-md-on-surface-variant leading-relaxed mb-6">
            Contributions are welcome: a new example agent, improvements to an existing one, or changes to
            the site itself.
          </p>
          <a
            href="https://github.com/Folken2/agent-directory"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'filled' })}
          >
            Contribute on GitHub
            <ArrowRight />
          </a>
        </Card>

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
            className={buttonVariants({ variant: 'outlined' })}
          >
            <Github />
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
