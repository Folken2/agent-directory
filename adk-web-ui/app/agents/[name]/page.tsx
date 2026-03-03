'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { adkClient } from '@/lib/adk-client';
import { Agent } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { 
  ArrowLeft, 
  Star, 
  Play, 
  Wrench, 
  Tag, 
  Sparkles, 
  Lightbulb,
  Share2,
  ExternalLink,
  Github,
  FileText,
  Calendar,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AgentModal from '@/components/AgentModal';

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentName = params?.name as string;
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toggleStarAgent, isAgentStarred, setSelectedAgent, setCurrentConversation } = useAppStore();

  useEffect(() => {
    const loadAgent = async () => {
      setIsLoading(true);
      try {
        const agents = await adkClient.listAgents();
        const foundAgent = agents.find(a => a.name === agentName);
        if (foundAgent) {
          setAgent(foundAgent);
        }
      } catch (error) {
        console.error('Error loading agent:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (agentName) {
      loadAgent();
    }
  }, [agentName]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${agent?.displayName || agent?.name} - Agent Directory`,
          text: agent?.description || '',
          url,
        });
      } catch (error) {
        // User cancelled or error occurred
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  const handleStartChat = () => {
    if (agent) {
      setSelectedAgent(agent);
      setCurrentConversation(null);
      router.push(`/chat?agent=${encodeURIComponent(agent.name)}`);
    }
  };

  const handleTryPrompt = (prompt: string) => {
    if (agent) {
      setSelectedAgent(agent);
      setCurrentConversation(null);
      router.push(`/chat?agent=${encodeURIComponent(agent.name)}&prompt=${encodeURIComponent(prompt)}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-md-surface via-md-surface-container-low/50 to-md-surface-container-low flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-md-surface via-md-surface-container-low/50 to-md-surface-container-low flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Agent Not Found</h1>
          <Link
            href="/"
            className="text-primary hover:underline inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Agents
          </Link>
        </div>
      </div>
    );
  }

  const isStarred = isAgentStarred(agent.name);

  return (
    <div className="min-h-screen bg-gradient-to-b from-md-surface via-md-surface-container-low/50 to-md-surface-container-low">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Agents
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-foreground mb-3 tracking-tight">
                {agent.displayName || agent.name}
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                {agent.description}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => toggleStarAgent(agent.name)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                aria-label={isStarred ? 'Unstar agent' : 'Star agent'}
              >
                <Star
                  className={cn(
                    "w-6 h-6 transition-all duration-300",
                    isStarred
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                />
              </button>
              <button
                onClick={handleShare}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                aria-label="Share agent"
              >
                <Share2 className="w-5 h-5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {agent.starsCount !== undefined && (
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <span>{agent.starsCount} stars</span>
                </div>
              )}
              {agent.runs !== undefined && (
                <div className="flex items-center gap-1">
                  <Play className="w-4 h-4" />
                  <span>{agent.runs} runs</span>
                </div>
              )}
              {agent.author && (
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span>{agent.author}</span>
                </div>
              )}
              {agent.version && (
                <div className="flex items-center gap-1">
                  <span>v{agent.version}</span>
                </div>
              )}
              {agent.lastUpdated && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>Updated {new Date(agent.lastUpdated).toLocaleDateString()}</span>
                </div>
              )}
            </div>
            
            {/* Top Play Button */}
            <button
              onClick={handleStartChat}
              className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-all shadow-sm hover:shadow flex items-center gap-2 shrink-0"
            >
              <Play className="w-4 h-4 fill-current" />
              Start Chat
            </button>
          </div>
        </div>

        {/* Links */}
        {(agent.githubUrl || agent.documentation) && (
          <div className="flex flex-wrap gap-3 mb-8">
            {agent.githubUrl && (
              <a
                href={agent.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-sm font-medium"
              >
                <Github className="w-4 h-4" />
                View on GitHub
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {agent.documentation && (
              <a
                href={agent.documentation}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-sm font-medium"
              >
                <FileText className="w-4 h-4" />
                Documentation
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Tags */}
        {agent.tags && agent.tags.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Tags
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {agent.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 text-sm font-medium bg-primary/5 text-primary rounded-lg border border-primary/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tools */}
        {agent.tools && agent.tools.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Tools
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {agent.tools.map((tool) => (
                <span
                  key={tool}
                  className="px-3 py-1.5 text-sm font-medium bg-muted text-foreground rounded-lg border border-border/50"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Use Cases */}
        {agent.useCases && agent.useCases.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Use Cases
              </h2>
            </div>
            <div className="space-y-2">
              {agent.useCases.map((useCase, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 text-sm text-foreground leading-relaxed bg-muted/40 border border-border/60 rounded-lg px-4 py-3"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span>{useCase}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sample Prompts */}
        {agent.samplePrompts && agent.samplePrompts.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Try This
              </h2>
            </div>
            <div className="grid gap-2">
              {agent.samplePrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTryPrompt(prompt)}
                  className="flex items-start gap-3 text-left px-4 py-3 rounded-xl border border-border/70 hover:border-primary/40 hover:shadow-sm bg-muted/30 transition-all"
                >
                  <span className="shrink-0 text-primary mt-0.5 inline-flex">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <span className="text-sm text-foreground leading-relaxed">{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="flex justify-end gap-3 pt-6 border-t border-border">
          <button
            onClick={handleStartChat}
            className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-all shadow-sm hover:shadow flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            Start Chat
          </button>
        </div>
      </div>

      {/* Modal for quick view */}
      {agent && (
        <AgentModal
          agent={agent}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}

