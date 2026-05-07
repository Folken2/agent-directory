'use client';

import { useAppStore } from '@/lib/store';
import { ChatConversation } from '@/lib/types';
import { Plus, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ChatHistory() {
  const {
    conversations,
    currentConversation,
    selectedAgent,
    setCurrentConversation,
    addConversation,
  } = useAppStore();

  const handleNewConversation = () => {
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

  const handleSelectConversation = (conversation: ChatConversation) => {
    setCurrentConversation(conversation);
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const filteredConversations = selectedAgent
    ? conversations.filter((conv) => conv.agentName === selectedAgent.name)
    : conversations;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header — quieter "new chat" affordance */}
      <div className="h-16 px-3 flex items-center border-b border-border/40 shrink-0">
        <button
          onClick={handleNewConversation}
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

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pt-3 pb-4">
        {filteredConversations.length === 0 ? (
          <div className="px-2 py-10 text-center">
            <MessageSquare className="w-7 h-7 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-[13px] font-medium text-md-on-surface-variant">No conversations yet</p>
            <p className="text-label-small text-md-on-surface-variant/60 uppercase tracking-widest mt-2">
              Start a new chat to begin
            </p>
          </div>
        ) : (
          <>
            <div className="px-2 pb-2 text-label-small text-md-on-surface-variant/70 uppercase tracking-widest">
              Recent{selectedAgent ? ` · ${selectedAgent.displayName || selectedAgent.name}` : ''}
            </div>
            <div className="space-y-0.5">
              {filteredConversations
                .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
                .map((conversation) => {
                  const isActive = currentConversation?.id === conversation.id;
                  return (
                    <button
                      key={conversation.id}
                      onClick={() => handleSelectConversation(conversation)}
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
                        {formatDate(conversation.updatedAt)}
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
