'use client';

import Link from 'next/link';
import { ArrowRight, Github, FileText, CheckCircle, Code, BookOpen } from 'lucide-react';

export default function ContributePage() {
  const steps = [
    {
      number: 1,
      title: 'Fork the Repository',
      description: 'Fork the ADK Agent Directory repository on GitHub to create your own copy.',
      icon: Github,
    },
    {
      number: 2,
      title: 'Create Your Agent',
      description: 'Develop your agent following the ADK structure and best practices.',
      icon: Code,
    },
    {
      number: 3,
      title: 'Add Metadata',
      description: 'Create a metadata.json file with agent information, use cases, and sample prompts.',
      icon: FileText,
    },
    {
      number: 4,
      title: 'Submit Pull Request',
      description: 'Submit a pull request with your agent for review and inclusion.',
      icon: ArrowRight,
    },
  ];

  const metadataTemplate = {
    name: "your_agent_name",
    displayName: "Your Agent Display Name",
    description: "A brief description of what your agent does",
    tools: ["tool1", "tool2"],
    tags: ["tag1", "tag2"],
    useCases: ["Use case 1", "Use case 2"],
    samplePrompts: ["Example prompt 1", "Example prompt 2"],
    author: "Your Name",
    githubUrl: "https://github.com/yourusername/your-repo",
    documentation: "https://your-docs-url.com",
    version: "1.0.0"
  };

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-display-small text-md-on-surface mb-4">
            Contribute Your Agent
          </h1>
          <p className="text-body-large text-md-on-surface-variant max-w-2xl mx-auto">
            Share your AI agents with the community. Follow these simple steps to contribute your agent to the ADK Agent Directory.
          </p>
        </div>

        {/* Steps */}
        <div className="mb-12 space-y-8">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-md-primary-container elevation-1 flex items-center justify-center">
                    <span className="text-label-large text-md-on-primary-container font-semibold">{step.number}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="w-5 h-5 text-md-primary" />
                    <h2 className="text-title-large text-md-on-surface">{step.title}</h2>
                  </div>
                  <p className="text-body-medium text-md-on-surface-variant">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Metadata Template */}
        <div className="mb-12 bg-md-surface elevation-1 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-5 h-5 text-md-primary" />
            <h2 className="text-headline-medium text-md-on-surface">Metadata Template</h2>
          </div>
          <p className="text-body-medium text-md-on-surface-variant mb-4">
            Create a <code className="px-2 py-1 bg-md-surface-container rounded text-label-medium text-md-on-surface">metadata.json</code> file in your agent directory with the following structure:
          </p>
          <pre className="bg-md-surface-container rounded-xl p-5 overflow-x-auto text-body-small">
            <code className="text-md-on-surface">{JSON.stringify(metadataTemplate, null, 2)}</code>
          </pre>
        </div>

        {/* Guidelines */}
        <div className="mb-12 space-y-6">
          <h2 className="text-headline-medium text-md-on-surface flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-md-primary" />
            Guidelines
          </h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <CheckCircle className="w-5 h-5 text-md-secondary shrink-0 mt-0.5" />
              <div>
                <h3 className="text-title-medium text-md-on-surface mb-1">Agent Quality</h3>
                <p className="text-body-small text-md-on-surface-variant">
                  Ensure your agent is well-tested, documented, and follows ADK best practices.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <CheckCircle className="w-5 h-5 text-md-secondary shrink-0 mt-0.5" />
              <div>
                <h3 className="text-title-medium text-md-on-surface mb-1">Complete Metadata</h3>
                <p className="text-body-small text-md-on-surface-variant">
                  Provide accurate descriptions, use cases, tags, and sample prompts to help users discover your agent.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <CheckCircle className="w-5 h-5 text-md-secondary shrink-0 mt-0.5" />
              <div>
                <h3 className="text-title-medium text-md-on-surface mb-1">Documentation</h3>
                <p className="text-body-small text-md-on-surface-variant">
                  Include a README.md file explaining how to use your agent, setup instructions, and any dependencies.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <CheckCircle className="w-5 h-5 text-md-secondary shrink-0 mt-0.5" />
              <div>
                <h3 className="text-title-medium text-md-on-surface mb-1">Code Quality</h3>
                <p className="text-body-small text-md-on-surface-variant">
                  Follow Python best practices, include type hints, and ensure your code is maintainable.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Resources */}
        <div className="mb-12 bg-md-surface-variant/30 rounded-2xl border border-md-outline p-8">
          <h2 className="text-headline-medium text-md-on-surface mb-6 flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-md-primary" />
            Resources
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <a
              href="https://github.com/Folken2/agent-directory"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 p-5 bg-md-surface rounded-xl border border-md-outline hover:border-md-primary transition-all elevation-0 hover:elevation-1"
            >
              <Github className="w-5 h-5 text-md-primary" />
              <div>
                <h3 className="text-title-small text-md-on-surface">GitHub Repository</h3>
                <p className="text-body-small text-md-on-surface-variant">View the source code</p>
              </div>
            </a>
            <Link
              href="/about"
              className="flex items-center gap-3 p-5 bg-md-surface rounded-xl border border-md-outline hover:border-md-primary transition-all elevation-0 hover:elevation-1"
            >
              <FileText className="w-5 h-5 text-md-primary" />
              <div>
                <h3 className="text-title-small text-md-on-surface">Documentation</h3>
                <p className="text-body-small text-md-on-surface-variant">Learn more about ADK</p>
              </div>
            </Link>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/contribute/submit"
            className="inline-flex items-center gap-2 px-8 py-4 bg-md-primary hover:bg-md-primary/92 text-md-on-primary rounded-full text-label-large transition-all elevation-2 hover:elevation-3"
          >
            Get Started
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
