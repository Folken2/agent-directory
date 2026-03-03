'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { adkClient } from '@/lib/adk-client';
import { Agent } from '@/lib/types';
import { ChevronDown, Bot, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function AgentSelector() {
  const { agents, selectedAgent, setAgents, setSelectedAgent, isLoading, setLoading, setError } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadAgents = async () => {
      setLoading(true);
      setError(null);
      try {
        const agentList = await adkClient.listAgents();
        setAgents(agentList);

        // Restore selected agent from localStorage
        const savedAgentName = typeof window !== 'undefined' ? localStorage.getItem('selectedAgent') : null;
        if (savedAgentName) {
          const agent = agentList.find(a => a.name === savedAgentName);
          if (agent) {
            setSelectedAgent(agent);
          } else if (agentList.length > 0) {
            setSelectedAgent(agentList[0]);
          }
        } else if (agentList.length > 0) {
          setSelectedAgent(agentList[0]);
        }
      } catch (error: any) {
        console.error('Error loading agents:', error);
        setError(error.message || 'Failed to load agents');
      } finally {
        setLoading(false);
      }
    };

    loadAgents();
  }, [setAgents, setSelectedAgent, setLoading, setError]);

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setIsOpen(false);
  };

  if (isLoading && agents.length === 0) {
    return (
      <div className="w-full max-w-md">
        <div className="px-4 py-3 bg-muted/50 rounded-xl animate-pulse flex items-center gap-3">
          <div className="w-8 h-8 bg-muted rounded-full"></div>
          <div className="h-4 bg-muted rounded w-32"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-md">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-card hover:bg-muted/50 border border-border rounded-xl shadow-sm transition-all flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/5 rounded-lg text-primary">
            <Bot className="w-5 h-5" />
          </div>
          <div className="flex flex-col items-start text-left">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agent</span>
            <span className="text-sm font-semibold text-foreground">
              {selectedAgent?.displayName || selectedAgent?.name || 'Select an agent'}
            </span>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute z-20 w-full mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden"
            >
              <div className="max-h-80 overflow-y-auto p-1">
                {agents.map((agent) => (
                  <button
                    key={agent.name}
                    onClick={() => handleSelectAgent(agent)}
                    className={cn(
                      "w-full px-3 py-3 text-left hover:bg-muted rounded-lg transition-colors flex items-start gap-3",
                      selectedAgent?.name === agent.name && "bg-muted"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg mt-0.5",
                      selectedAgent?.name === agent.name ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground text-sm">{agent.displayName || agent.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {agent.description}
                      </div>
                      {agent.tools && agent.tools.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {agent.tools.slice(0, 3).map((tool) => (
                            <span
                              key={tool}
                              className="px-1.5 py-0.5 text-[10px] bg-background border border-border text-muted-foreground rounded"
                            >
                              {tool}
                            </span>
                          ))}
                          {agent.tools.length > 3 && (
                            <span className="px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              +{agent.tools.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

