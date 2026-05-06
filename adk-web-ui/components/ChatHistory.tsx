'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { ChatConversation } from '@/lib/types';
import { Plus, MessageSquare, Clock } from 'lucide-react';
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
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  // Filter conversations by selected agent
  const filteredConversations = selectedAgent
    ? conversations.filter((conv) => conv.agentName === selectedAgent.name)
    : conversations;

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="h-[57px] px-4 flex items-center border-b border-border/40 shrink-0">
        <button
          onClick={handleNewConversation}
          disabled={!selectedAgent}
          className={cn(
            "w-full px-4 py-2 rounded-xl transition-colors font-medium flex items-center justify-center gap-2 text-sm shadow-sm",
            !selectedAgent
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary hover:bg-primary/90 text-primary-foreground"
          )}
        >
          <Plus className="w-4 h-4" />
          New Conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No conversations</p>
            <p className="text-xs mt-1 opacity-70">Start a new chat to begin</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredConversations
              .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
              .map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => handleSelectConversation(conversation)}
                  className={cn(
                    "w-full px-3 py-3 text-left rounded-lg transition-all group",
                    currentConversation?.id === conversation.id
                      ? "bg-muted text-foreground"
                      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="font-medium text-sm truncate pr-2">
                    {conversation.title || 'Untitled'}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <div className="flex items-center gap-1 text-[10px] opacity-70">
                      <MessageSquare className="w-3 h-3" />
                      {conversation.messages.length}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] opacity-70">
                      <Clock className="w-3 h-3" />
                      {formatDate(conversation.updatedAt)}
                    </div>
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
