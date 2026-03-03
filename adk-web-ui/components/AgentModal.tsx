'use client';

import { Agent } from '@/lib/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { Star, X, Wrench, Play, Tag, Sparkles, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface AgentModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function AgentModal({ agent, isOpen, onClose }: AgentModalProps) {
  const router = useRouter();
  const { setSelectedAgent, setCurrentConversation, toggleStarAgent, isAgentStarred } = useAppStore();
  const isStarred = isAgentStarred(agent?.name || '');

  if (!agent) return null;

  const handleTryPrompt = (prompt: string) => {
    const params = new URLSearchParams({
      agent: agent.name,
      prompt,
    });

    setSelectedAgent(agent);
    setCurrentConversation(null);
    router.push(`/chat?${params.toString()}`);
    onClose();
  };

  const handleTestAgent = () => {
    setSelectedAgent(agent);
    setCurrentConversation(null); // Clear conversation when testing
    router.push(`/chat?agent=${encodeURIComponent(agent.name)}`);
  };

  const handleStarClick = () => {
    toggleStarAgent(agent.name);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4 flex-1">
                  <h2 className="text-3xl font-bold text-foreground tracking-tight">
                    {agent.displayName || agent.name}
                  </h2>
                  <button
                    onClick={handleStarClick}
                    className="p-2 hover:bg-muted rounded-full transition-colors"
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
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-6 h-6 text-muted-foreground hover:text-foreground" />
                </button>
              </div>

              <div className="mb-8">
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  Description
                </h3>
                <p className="text-lg text-foreground leading-relaxed">
                  {agent.description || 'No description available'}
                </p>
              </div>

              {agent.tags && agent.tags.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Tags
                    </h3>
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

              {agent.tools && agent.tools.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Wrench className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Tools
                    </h3>
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

              {agent.useCases && agent.useCases.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Use cases
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {agent.useCases.map((useCase, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 text-sm text-foreground leading-relaxed bg-muted/40 border border-border/60 rounded-lg px-3 py-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        <span>{useCase}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {agent.samplePrompts && agent.samplePrompts.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Try this
                    </h3>
                  </div>
                  <div className="grid gap-2">
                    {agent.samplePrompts.map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleTryPrompt(prompt)}
                        className="flex items-start gap-3 text-left px-3 py-2.5 rounded-xl border border-border/70 hover:border-primary/40 hover:shadow-sm bg-muted/30 transition-all"
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

              <div className="flex justify-between items-center pt-6 border-t border-border">
                <Link
                  href={`/agents/${agent.name}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={onClose}
                >
                  View full page →
                </Link>
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="px-5 py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors font-medium"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleTestAgent}
                    className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium transition-all shadow-sm hover:shadow flex items-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Start Chat
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

