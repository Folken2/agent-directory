'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ChatInterface from '@/components/ChatInterface';
import ChatHistory from '@/components/ChatHistory';
import { useAppStore } from '@/lib/store';
import { toConversationId } from '@/lib/ids';
import { Agent, ChatConversation, Message } from '@/lib/types';
import { Menu, ArrowLeft, AlertCircle, X, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

function ChatContent() {
  const { error, setError, agents, setAgents, setSelectedAgent, setCurrentConversation, selectedAgent } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const resumedSessionRef = useRef<string | null>(null);
  const resolvedAgentRef = useRef<string | null>(null);

  // Initialize sidebar state based on screen size (mobile-first: closed by default)
  useEffect(() => {
    // Check if we're on desktop (≥1024px)
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    
    // Set initial state based on screen size
    const handleInitialState = () => {
      setSidebarOpen(mediaQuery.matches);
    };
    
    // Check immediately
    handleInitialState();
    
    // Listen for changes (for orientation changes, window resizing, etc.)
    mediaQuery.addEventListener('change', handleInitialState);
    return () => mediaQuery.removeEventListener('change', handleInitialState);
  }, []);

  useEffect(() => {
    // Hydrate user preferences (selectedAgent, starredAgents) from
    // localStorage. Past chat history is loaded from the DB by ChatHistory,
    // not the store.
    useAppStore.getState().loadPreferences();

    const agentName = searchParams.get('agent');
    const sessionParam = searchParams.get('session');
    const promptParam = searchParams.get('prompt');
    setInitialPrompt(promptParam || null);

    if (!agentName) return;
    // Important: the global agents array isn't reliably populated (AgentGrid
    // uses local state, AgentSelector isn't mounted), so we can't gate on
    // agents.length here. Resolve the agent from whichever source is fastest
    // and fall back to fetching the directory if needed.
    if (resolvedAgentRef.current === agentName) return;
    resolvedAgentRef.current = agentName;

    const resolveAgent = async (): Promise<Agent | null> => {
      const fromList = agents.find(a => a.name === agentName);
      if (fromList) return fromList;
      if (selectedAgent?.name === agentName) return selectedAgent;
      try {
        const r = await fetch('/api/agents');
        if (!r.ok) return null;
        const j = await r.json();
        const list: Agent[] = Array.isArray(j?.data) ? j.data : [];
        if (list.length > 0) setAgents(list);
        return list.find(a => a.name === agentName) ?? null;
      } catch {
        return null;
      }
    };

    (async () => {
      const agent = await resolveAgent();
      if (!agent) {
        // Couldn't find the agent at all — let downstream UI handle it.
        return;
      }
      setSelectedAgent(agent);

      // Resume mode: hydrate a past ADK session and wire the conversation
      // id so handleSend reuses the same session_id. The conversation id is
      // derived from the session id via toConversationId() — these always
      // round-trip 1:1 (see lib/ids.ts).
      if (sessionParam && resumedSessionRef.current !== sessionParam) {
        resumedSessionRef.current = sessionParam;
        try {
          const res = await fetch(`/api/me/sessions/${encodeURIComponent(sessionParam)}`);
          if (!res.ok) {
            if (res.status !== 404) {
              console.error('Failed to load session transcript:', res.status);
            }
            setCurrentConversation(null);
            return;
          }
          const json = await res.json();
          const turns: Array<{ author: 'user' | 'assistant'; text: string; at: string }> =
            json?.transcript?.turns ?? [];

          const messages: Message[] = turns.map((t, idx) => ({
            id: `resumed-${sessionParam}-${idx}`,
            role: t.author,
            content: t.text,
            timestamp: new Date(t.at),
            agentName: agent.name,
          }));

          const firstUser = turns.find((t) => t.author === 'user');
          const conversation: ChatConversation = {
            id: toConversationId(sessionParam),
            title: (firstUser?.text || 'Resumed conversation').slice(0, 50),
            agentName: agent.name,
            messages,
            createdAt: turns[0] ? new Date(turns[0].at) : new Date(),
            updatedAt: new Date(),
            resumedFrom: turns[0] ? new Date(turns[0].at) : new Date(),
          };
          // Don't push resumed conversations into the in-memory store —
          // the sidebar pulls authed sessions from the DB directly, so adding
          // them here would just create duplicates and cross-agent leakage.
          setCurrentConversation(conversation);
        } catch (e) {
          console.error('Error resuming session:', e);
          setCurrentConversation(null);
        }
      } else if (!sessionParam) {
        // Fresh chat for this agent
        setCurrentConversation(null);
      }
    })();
  }, [searchParams, agents, selectedAgent, setAgents, setSelectedAgent, setCurrentConversation]);

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar — snap toggle (no width transition) avoids reflowing the message list every frame */}
      <div
        className={cn(
          'overflow-hidden border-r border-border/40 lg:block hidden',
          sidebarOpen ? 'w-60' : 'w-0',
        )}
      >
        <div className="h-full w-60">
          <ChatHistory />
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-background border-r border-border/40 shadow-xl">
            <ChatHistory />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Header — agent identity is the title; collapse + back are tertiary */}
        <header className="border-b border-border/40 px-4 sm:px-5 h-16 flex items-center z-10 shrink-0">
          <div className="flex items-center justify-between w-full gap-3">
            <div className="flex items-center gap-1 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                aria-label={sidebarOpen ? 'Hide history' : 'Show history'}
                title={sidebarOpen ? 'Hide history' : 'Show history'}
              >
                {/* mobile uses a hamburger; desktop uses a panel-toggle icon */}
                <Menu className="w-5 h-5 lg:hidden" />
                <PanelLeft className="w-5 h-5 hidden lg:block" />
              </button>

              {selectedAgent ? (
                <Link
                  href={`/agents/${encodeURIComponent(selectedAgent.name)}`}
                  className="flex flex-col items-start text-left ml-2 min-w-0 hover:opacity-90 transition-opacity"
                >
                  <span className="text-[15px] font-semibold tracking-tight text-foreground leading-tight truncate max-w-[60vw] sm:max-w-md">
                    {selectedAgent.displayName || selectedAgent.name}
                  </span>
                  <span className="text-label-small text-md-on-surface-variant/60 uppercase tracking-widest mt-1">
                    Powered by Gemini 3 Flash
                  </span>
                </Link>
              ) : (
                <div className="ml-2 flex flex-col">
                  <span className="text-[15px] font-semibold tracking-tight text-foreground leading-tight">
                    Chat
                  </span>
                  <span className="text-label-small text-md-on-surface-variant/60 uppercase tracking-widest mt-1">
                    Select an agent to begin
                  </span>
                </div>
              )}
            </div>

            <Link
              href={selectedAgent ? `/agents/${encodeURIComponent(selectedAgent.name)}` : '/'}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </div>
        </header>

        {/* Error Banner */}
        {error && (
          <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <span className="text-sm font-medium text-destructive">{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-destructive hover:text-destructive/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Chat Area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-background">
            <ChatInterface initialPrompt={initialPrompt || undefined} />
          </div>
        </div>
      </div>

    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
