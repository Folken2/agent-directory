'use client';

import Link from 'next/link';
import { ArrowLeft, Github, CheckCircle, ExternalLink } from 'lucide-react';

export default function SubmitPage() {
  const checklist = [
    'Agent code is complete and tested',
    'metadata.json file is created with all required fields',
    'README.md file includes setup and usage instructions',
    'Code follows Python best practices and includes type hints',
    'Agent handles errors gracefully',
    'Dependencies are documented',
    'Sample prompts are provided in metadata.json',
    'Use cases and tags are accurately described',
  ];

  return (
    <div className="min-h-screen bg-linear-to-b from-md-surface via-md-surface-container-low/50 to-md-surface-container-low pt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link
          href="/contribute"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Contribute
        </Link>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
            Submit Your Agent
          </h1>
          <p className="text-xl text-muted-foreground">
            Ready to submit? Follow these final steps to create your pull request.
          </p>
        </div>

        {/* Checklist */}
        <div className="mb-12 bg-card rounded-2xl border border-border p-8">
          <h2 className="text-2xl font-semibold text-foreground mb-6">
            Pre-Submission Checklist
          </h2>
          <div className="space-y-3">
            {checklist.map((item, index) => (
              <div key={index} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Submission Steps */}
        <div className="mb-12 space-y-8">
          <div className="bg-card rounded-2xl border border-border p-8">
            <h2 className="text-2xl font-semibold text-foreground mb-6">
              Submission Steps
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  1. Fork and Clone the Repository
                </h3>
                <p className="text-muted-foreground mb-3">
                  Fork the Agent Directory repository on GitHub, then clone your fork locally.
                </p>
                <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                  <code>git clone https://github.com/YOUR_USERNAME/agent-directory.git</code>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  2. Create Your Agent Directory
                </h3>
                <p className="text-muted-foreground mb-3">
                  Create a new directory for your agent following the naming convention (lowercase with underscores).
                </p>
                <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                  <code>mkdir your_agent_name</code>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  3. Add Your Agent Code
                </h3>
                <p className="text-muted-foreground mb-3">
                  Add your agent implementation, tools, and configuration files to the directory.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  4. Create metadata.json
                </h3>
                <p className="text-muted-foreground mb-3">
                  Create a metadata.json file in your agent directory with all required fields.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  5. Commit and Push
                </h3>
                <p className="text-muted-foreground mb-3">
                  Commit your changes and push to your fork.
                </p>
                <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-2">
                  <div><code>git add your_agent_name/</code></div>
                  <div><code>git commit -m "Add your_agent_name agent"</code></div>
                  <div><code>git push origin main</code></div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  6. Create Pull Request
                </h3>
                <p className="text-muted-foreground mb-3">
                  Navigate to the original repository on GitHub and create a pull request with a clear description of your agent.
                </p>
                <a
                  href="https://github.com/Folken2/agent-directory"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
                >
                  <Github className="w-4 h-4" />
                  Create Pull Request
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* PR Template */}
        <div className="mb-12 bg-muted/30 rounded-2xl border border-border p-8">
          <h2 className="text-2xl font-semibold text-foreground mb-6">
            Pull Request Template
          </h2>
          <p className="text-muted-foreground mb-4">
            Use this template when creating your pull request:
          </p>
          <div className="bg-card rounded-lg p-4 border border-border">
            <pre className="text-sm whitespace-pre-wrap">
{`## Agent: [Agent Name]

### Description
Brief description of what your agent does.

### Use Cases
- Use case 1
- Use case 2

### Tools Used
- Tool 1
- Tool 2

### Testing
Describe how you tested your agent.

### Documentation
Link to any additional documentation or examples.`}
            </pre>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-primary/5 rounded-2xl border border-primary/20 p-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            What Happens Next?
          </h2>
          <ul className="space-y-2 text-muted-foreground">
            <li>• Your pull request will be reviewed by maintainers</li>
            <li>• Feedback may be requested for improvements</li>
            <li>• Once approved, your agent will be merged and appear in the Agent Directory</li>
            <li>• You'll be credited as the agent author</li>
          </ul>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <a
            href="https://github.com/Folken2/agent-directory"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-all shadow-lg hover:shadow-xl"
          >
            <Github className="w-5 h-5" />
            Open GitHub Repository
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
      </div>
    </div>
  );
}

