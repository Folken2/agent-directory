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
  Share2,
  ExternalLink,
  Github,
  FileText,
  Calendar,
  User,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCategoryColors } from '@/lib/category-colors';

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentName = params?.name as string;
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toggleStarAgent, isAgentStarred, setSelectedAgent, setCurrentConversation } = useAppStore();

  useEffect(() => {
    const loadAgent = async () => {
      setIsLoading(true);
      try {
        const agents = await adkClient.listAgents();
        const foundAgent = agents.find((a) => a.name === agentName);
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
      } catch {
        // User cancelled
      }
    } else {
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
  const categoryColors = getCategoryColors(agent.category);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Agents
        </Link>

        {/* ZONE 1: HERO */}
        <section className="mb-12">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                {agent.logo && (
                  <div className="shrink-0 w-12 h-12 rounded-lg bg-md-surface-container border border-md-outline-variant/50 flex items-center justify-center overflow-hidden p-2">
                    <img
                      src={agent.logo}
                      alt={`${agent.displayName || agent.name} logo`}
                      className="object-contain w-full h-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div>
                  <h1 className="text-4xl font-bold text-foreground tracking-tight">
                    {agent.displayName || agent.name}
                  </h1>
                  <div className="flex items-center gap-3 mt-1.5">
                    {agent.category && (
                      <span className={cn(
                        "inline-flex px-2.5 py-0.5 rounded-md text-xs font-semibold border",
                        categoryColors.bg, categoryColors.text, categoryColors.border
                      )}>
                        {agent.category}
                      </span>
                    )}
                    {agent.author && (
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {agent.author}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed mt-4">
                {agent.description}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <button
              onClick={handleStartChat}
              className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-all shadow-sm hover:shadow flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Start Chat
            </button>
            <button
              onClick={() => toggleStarAgent(agent.name)}
              className={cn(
                "px-4 py-3 rounded-xl font-medium border flex items-center gap-2 transition-all",
                isStarred
                  ? "bg-md-tertiary-container/30 border-md-tertiary/40 text-md-on-tertiary-container"
                  : "bg-md-surface border-md-outline hover:bg-muted text-foreground"
              )}
              aria-label={isStarred ? 'Unstar agent' : 'Star agent'}
            >
              <Star
                className={cn(
                  "w-4 h-4",
                  isStarred ? "fill-md-tertiary text-md-tertiary" : "text-muted-foreground"
                )}
              />
              {isStarred ? 'Starred' : 'Star'}
              {agent.starsCount !== undefined && (
                <span className="text-sm text-muted-foreground ml-1">({agent.starsCount})</span>
              )}
            </button>
            <button
              onClick={handleShare}
              className="px-4 py-3 rounded-xl font-medium border border-md-outline bg-md-surface hover:bg-muted text-foreground flex items-center gap-2 transition-all"
              aria-label="Share agent"
            >
              <Share2 className="w-4 h-4 text-muted-foreground" />
              Share
            </button>
          </div>
        </section>

        {/* ZONE 2: STORY */}
        {agent.useCases && agent.useCases.length > 0 && (
          <section className="mb-12 bg-md-surface-container-low/50 border border-md-outline-variant/40 rounded-2xl p-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">
              What this agent excels at
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {agent.useCases.map((useCase, idx) => (
                <div
                  key={idx}
                  className="bg-md-surface rounded-xl border border-md-outline-variant/50 p-5 hover:shadow-elevation-2 transition-all"
                >
                  <h3 className="text-base font-semibold text-foreground mb-1.5">
                    {useCase.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {useCase.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ZONE 3: ACTION */}
        {agent.samplePrompts && agent.samplePrompts.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Try it out
              </h2>
            </div>
            <div className="grid gap-3">
              {agent.samplePrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTryPrompt(prompt)}
                  className="group/prompt flex items-center gap-4 text-left px-5 py-4 rounded-xl border border-md-outline-variant/60 hover:border-md-primary/40 hover:shadow-elevation-2 bg-md-surface transition-all"
                >
                  <span className="shrink-0 text-primary">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <span className="text-sm text-foreground leading-relaxed flex-1">
                    {prompt}
                  </span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover/prompt:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ZONE 4: METADATA FOOTER */}
        <section className="border-t border-md-outline-variant/40 pt-8 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-muted-foreground">
            {/* Tools */}
            {agent.tools && agent.tools.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Wrench className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Tools</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {agent.tools.map((tool) => (
                    <span
                      key={tool}
                      className="px-2 py-0.5 text-xs font-mono bg-muted rounded border border-border/50"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {agent.tags && agent.tags.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Tag className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Tags</span>
                </div>
                <p className="text-sm">
                  {agent.tags.join(' · ')}
                </p>
              </div>
            )}

            {/* Links */}
            {(agent.githubUrl || agent.documentation) && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider block mb-2">Links</span>
                <div className="flex flex-wrap gap-3">
                  {agent.githubUrl && (
                    <a
                      href={agent.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                    >
                      <Github className="w-3.5 h-3.5" />
                      GitHub
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {agent.documentation && (
                    <a
                      href={agent.documentation}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Docs
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Version & Updated */}
            {(agent.version || agent.lastUpdated) && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider block mb-2">Info</span>
                <div className="flex items-center gap-3">
                  {agent.version && <span>v{agent.version}</span>}
                  {agent.lastUpdated && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Updated {new Date(agent.lastUpdated).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
