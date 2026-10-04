'use client';

import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ChatInterface from '@/components/ChatInterface';
import ChatHistory from '@/components/ChatHistory';
import AgentSwitcher from '@/components/chat/AgentSwitcher';
import PreviewPanel from '@/components/preview/PreviewPanel';
import { useAppStore } from '@/lib/store';
import { toConversationId, toSessionId, replayedMessageId } from '@/lib/ids';
import { Agent, ChatConversation, Message } from '@/lib/types';
import { Menu, ArrowLeft, AlertCircle, X, PanelLeft, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BUILDER_AGENT, MAX_BUILDER_PROMPT_LENGTH, resolveChatAgentName } from '@/lib/builder';
import { parsePreviewState } from '@/lib/preview/types';
import { loadConversation, saveConversation } from '@/lib/chat/local-history';
import ChatSkeleton from '@/components/chat/ChatSkeleton';

function ChatContent() {
  const {
    error,
    setError,
    agents,
    setAgents,
    setSelectedAgent,
    setCurrentConversation,
    selectedAgent,
    currentConversation,
    builderPreview,
    setBuilderPreview,
  } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // The preview the user closed (`<session>:<startedAt>`); a restart reopens the panel.
  const [closedPreview, setClosedPreview] = useState<string | null>(null);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  // Set once the requested agent is selected and a fresh conversation is in
  // place, so an auto-sent prompt can't race the conversation reset.
  const [autoSendPrompt, setAutoSendPrompt] = useState<string | null>(null);
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

    // No ?agent= means the builder: it is the site's default conversation.
    const agentName = resolveChatAgentName(searchParams.get('agent'));
    const sessionParam = searchParams.get('session');
    const promptParam = searchParams.get('prompt')?.slice(0, MAX_BUILDER_PROMPT_LENGTH) || null;
    // ?send=1 sends the prompt on arrival instead of prefilling the composer.
    const autoSend = searchParams.get('send') === '1' && !!promptParam && !sessionParam;
    setInitialPrompt(autoSend ? null : promptParam);

    // Important: the global agents array isn't reliably populated (AgentGrid
    // uses local state and nothing else populates it), so we can't gate on
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
            id: replayedMessageId(sessionParam, idx),
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
        // Fresh visit: restore this agent's locally saved chat, unless a
        // prompt is about to start a new one.
        setCurrentConversation(autoSend ? null : loadConversation(agent.name));
        if (autoSend) setAutoSendPrompt(promptParam);
      }
    })();
  }, [searchParams, agents, selectedAgent, setAgents, setSelectedAgent, setCurrentConversation]);

  // Keep the current chat across refreshes. Resumed server sessions are
  // already persisted, and an emptied conversation (new chat) clears the slot.
  useEffect(() => {
    if (!currentConversation || currentConversation.resumedFrom) return;
    saveConversation(currentConversation);
  }, [currentConversation]);

  // The builder's live preview for this chat, if it started one.
  const builderSessionId =
    selectedAgent?.name === BUILDER_AGENT && currentConversation ? toSessionId(currentConversation.id) : null;
  const preview =
    builderSessionId && builderPreview?.sessionId === builderSessionId ? builderPreview.state : null;
  const hasHistory = (currentConversation?.messages.length ?? 0) > 0;
  const previewKey = preview ? `${builderSessionId}:${preview.startedAt ?? ''}` : null;
  const previewOpen = !!previewKey && closedPreview !== previewKey;

  // After a refresh or when reopening a builder chat, ask whether its preview still runs.
  useEffect(() => {
    if (!builderSessionId || !hasHistory) return;
    let cancelled = false;
    fetch(`/api/preview?session_id=${encodeURIComponent(builderSessionId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const data = json?.data;
        if (cancelled || !data?.running) return;
        const state = parsePreviewState({ ...data, status: 'running' });
        if (state) setBuilderPreview({ sessionId: builderSessionId, state });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [builderSessionId, hasHistory, setBuilderPreview]);

  const handleAutoSent = useCallback(() => {
    setAutoSendPrompt(null);
    // Drop prompt/send from the URL so a refresh doesn't send it again.
    const url = new URL(window.location.href);
    url.searchParams.delete('prompt');
    url.searchParams.delete('send');
    window.history.replaceState(window.history.state, '', url.pathname + url.search);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-md-surface-container-low text-md-on-surface">
      {/* Sidebar — snap toggle (no width transition) avoids reflowing the message list every frame */}
      <div
        className={cn(
          'overflow-hidden border-r border-md-outline/40 lg:block hidden',
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
            className="absolute inset-0 bg-md-surface-container-low/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-md-surface-container-low border-r border-md-outline/40 shadow-xl">
            <ChatHistory />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden bg-md-surface-container-low">
        {/* Header — agent identity is the title; collapse + back are tertiary */}
        <header className="border-b border-md-outline/40 px-4 sm:px-5 h-16 flex items-center z-10 shrink-0">
          <div className="flex items-center justify-between w-full gap-3">
            <div className="flex items-center gap-1 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-md-surface-container rounded-lg transition-colors text-md-on-surface-variant hover:text-md-on-surface"
                aria-label={sidebarOpen ? 'Hide history' : 'Show history'}
                title={sidebarOpen ? 'Hide history' : 'Show history'}
              >
                {/* mobile uses a hamburger; desktop uses a panel-toggle icon */}
                <Menu className="w-5 h-5 lg:hidden" />
                <PanelLeft className="w-5 h-5 hidden lg:block" />
              </button>

              <AgentSwitcher agent={selectedAgent} />
            </div>

            {preview && !previewOpen && (
              <button
                onClick={() => setClosedPreview(null)}
                className="ml-auto shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-md-primary hover:bg-md-primary/8 rounded-full transition-colors"
              >
                <Play className="w-4 h-4" />
                Preview
              </button>
            )}

            <Link
              href={selectedAgent ? `/agents/${encodeURIComponent(selectedAgent.name)}` : '/'}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-container rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </div>
        </header>

        {/* Error Banner */}
        {error && (
          <div className="bg-md-error/10 border-b border-md-error/20 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-md-error" />
                <span className="text-sm font-medium text-md-error">{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-md-error hover:text-md-error/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Chat Area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-md-surface-container-low">
            <ChatInterface
              initialPrompt={initialPrompt || undefined}
              autoSendPrompt={autoSendPrompt}
              onAutoSent={handleAutoSent}
            />
          </div>

          {/* Live preview of the agent being built: a column on wide screens, full screen on small ones */}
          {preview && builderSessionId && previewOpen && (
            <PreviewPanel
              key={previewKey}
              sessionId={builderSessionId}
              state={preview}
              onClose={() => setClosedPreview(previewKey)}
              className="fixed inset-0 z-50 lg:static lg:z-auto lg:w-[42%] lg:max-w-2xl lg:border-l lg:border-md-outline/40"
            />
          )}
        </div>
      </div>

    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatContent />
    </Suspense>
  );
}
