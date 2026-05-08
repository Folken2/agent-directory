'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAppStore } from '@/lib/store';
import { ChatConversation } from '@/lib/types';
import { Plus, MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type DbSession = {
  sessionId: string;
  agentSlug: string;
  firstMessage: string | null;
  messageCount: number;
  startedAt: string;
  lastActivityAt: string;
};

function formatRelative(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) {
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1) return 'Just now';
    return `${hours}h ago`;
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function truncate(s: string | null, max = 60): string {
  if (!s) return 'Untitled';
  return s.length > max ? s.slice(0, max).trimEnd() + '…' : s;
}

export default function ChatHistory() {
  const {
    conversations,
    currentConversation,
    selectedAgent,
    setCurrentConversation,
    addConversation,
  } = useAppStore();

  const router = useRouter();
  const { data: session, status } = useSession();
  const isAuthed = status === 'authenticated' && !!session?.user;

  const [dbSessions, setDbSessions] = useState<DbSession[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);

  // Per-agent DB sessions for authenticated users. Filtered server-side, so
  // there's no cross-agent leakage and the list survives page refreshes.
  useEffect(() => {
    if (!isAuthed || !selectedAgent) {
      setDbSessions([]);
      return;
    }
    let cancelled = false;
    setLoadingDb(true);
    fetch(`/api/me/sessions?agent=${encodeURIComponent(selectedAgent.name)}`)
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((j) => {
        if (cancelled) return;
        setDbSessions(Array.isArray(j?.sessions) ? j.sessions : []);
      })
      .catch(() => {
        if (!cancelled) setDbSessions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingDb(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthed, selectedAgent?.name, currentConversation?.id]);

  const handleNewChat = () => {
    if (!selectedAgent) return;
    const newConv: ChatConversation = {
      id: `conv-${Date.now()}`,
      title: 'New Conversation',
      agentName: selectedAgent.name,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    addConversation(newConv);
    setCurrentConversation(newConv);
  };

  // For anonymous users, fall back to per-tab in-memory conversations.
  const localConversations = selectedAgent
    ? conversations
        .filter((c) => c.agentName === selectedAgent.name)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    : [];

  const renderEmpty = (
    <div className="px-2 py-10 text-center">
      <MessageSquare className="w-7 h-7 mx-auto mb-3 text-muted-foreground/40" />
      <p className="text-[13px] font-medium text-md-on-surface-variant">No past chats yet</p>
      <p className="text-label-small text-md-on-surface-variant/60 uppercase tracking-widest mt-2">
        Start a new chat to begin
      </p>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="h-16 px-3 flex items-center border-b border-border/40 shrink-0">
        <button
          onClick={handleNewChat}
          disabled={!selectedAgent}
          className={cn(
            'w-full px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium',
            !selectedAgent
              ? 'text-muted-foreground/60 cursor-not-allowed'
              : 'text-foreground hover:bg-muted',
          )}
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pt-3 pb-4">
        {!selectedAgent ? (
          renderEmpty
        ) : isAuthed ? (
          <>
            <div className="px-2 pb-2 text-label-small text-md-on-surface-variant/70 uppercase tracking-widest flex items-center gap-2">
              Recent · {selectedAgent.displayName || selectedAgent.name}
              {loadingDb && <Loader2 className="w-3 h-3 animate-spin" />}
            </div>
            {dbSessions.length === 0 && !loadingDb ? (
              renderEmpty
            ) : (
              <div className="space-y-0.5">
                {dbSessions.map((s) => {
                  const rawId = s.sessionId.replace(/^session-/, '');
                  const isActive = currentConversation?.id === `conv-${rawId}`;
                  return (
                    <button
                      key={s.sessionId}
                      onClick={() =>
                        router.push(
                          `/chat?agent=${encodeURIComponent(s.agentSlug)}&session=${encodeURIComponent(s.sessionId)}`,
                        )
                      }
                      className={cn(
                        'group w-full px-3 py-2.5 text-left rounded-lg transition-colors flex items-baseline gap-2',
                        isActive
                          ? 'bg-muted text-foreground'
                          : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <span className="flex-1 text-[13px] leading-snug truncate">
                        {truncate(s.firstMessage)}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 text-[10px] tabular-nums transition-opacity',
                          isActive
                            ? 'text-muted-foreground'
                            : 'text-muted-foreground/60 opacity-0 group-hover:opacity-100',
                        )}
                      >
                        {formatRelative(new Date(s.lastActivityAt))}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : localConversations.length === 0 ? (
          renderEmpty
        ) : (
          <>
            <div className="px-2 pb-2 text-label-small text-md-on-surface-variant/70 uppercase tracking-widest">
              Recent · {selectedAgent.displayName || selectedAgent.name}
            </div>
            <div className="space-y-0.5">
              {localConversations.map((conversation) => {
                const isActive = currentConversation?.id === conversation.id;
                return (
                  <button
                    key={conversation.id}
                    onClick={() => setCurrentConversation(conversation)}
                    className={cn(
                      'group w-full px-3 py-2.5 text-left rounded-lg transition-colors flex items-baseline gap-2',
                      isActive
                        ? 'bg-muted text-foreground'
                        : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <span className="flex-1 text-[13px] leading-snug truncate">
                      {conversation.title || 'Untitled'}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 text-[10px] tabular-nums transition-opacity',
                        isActive
                          ? 'text-muted-foreground'
                          : 'text-muted-foreground/60 opacity-0 group-hover:opacity-100',
                      )}
                    >
                      {formatRelative(conversation.updatedAt)}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
