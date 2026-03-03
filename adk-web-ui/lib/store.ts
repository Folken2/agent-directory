// Zustand store for global state management
import { create } from 'zustand';
import { Agent, Message, ChatConversation, Artifact, ToolStatus } from './types';

interface AppState {
  agents: Agent[];
  selectedAgent: Agent | null;
  currentConversation: ChatConversation | null;
  conversations: ChatConversation[];
  artifacts: Artifact[];
  starredAgents: string[];
  isLoading: boolean;
  error: string | null;
  activeTools: Record<string, ToolStatus>; // Tools keyed by tool ID
  messageTools: Record<string, string[]>; // Message ID -> array of tool IDs

  // Actions
  setAgents: (agents: Agent[]) => void;
  setSelectedAgent: (agent: Agent | null) => void;
  setCurrentConversation: (conversation: ChatConversation | null) => void;
  addMessage: (message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  addConversation: (conversation: ChatConversation) => void;
  updateConversation: (id: string, updates: Partial<ChatConversation>) => void;
  setArtifacts: (artifacts: Artifact[]) => void;
  addArtifact: (artifact: Artifact) => void;
  toggleStarAgent: (agentName: string) => void;
  isAgentStarred: (agentName: string) => boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  loadConversations: () => void;
  saveConversations: () => void;
  loadStarredAgents: () => void;
  saveStarredAgents: () => void;
  addToolCall: (toolCall: ToolStatus, messageId: string) => void;
  updateToolResponse: (toolId: string, response: any, error?: string) => void;
  getToolsForMessage: (messageId: string) => ToolStatus[];
  clearTools: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  agents: [],
  selectedAgent: null,
  currentConversation: null,
  conversations: [],
  artifacts: [],
  starredAgents: [],
  isLoading: false,
  error: null,
  activeTools: {},
  messageTools: {},

  setAgents: (agents) => set({ agents }),
  
  setSelectedAgent: (agent) => {
    set({ selectedAgent: agent });
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedAgent', agent?.name || '');
    }
  },

  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),

  addMessage: (message) => {
    const { currentConversation } = get();
    if (currentConversation) {
      const updated = {
        ...currentConversation,
        messages: [...currentConversation.messages, message],
        updatedAt: new Date(),
      };
      set({ currentConversation: updated });
      get().updateConversation(currentConversation.id, updated);
    }
  },

  updateMessage: (conversationId, messageId, updates) => {
    const { conversations, currentConversation } = get();
    const updateMessages = (messages: Message[]) =>
      messages.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg));

    // Update current conversation if it matches
    if (currentConversation && currentConversation.id === conversationId) {
      const updated = {
        ...currentConversation,
        messages: updateMessages(currentConversation.messages),
        updatedAt: new Date(),
      };
      set({ currentConversation: updated });
    }

    // Update in conversations list
    const updatedConversations = conversations.map((conv) =>
      conv.id === conversationId
        ? {
            ...conv,
            messages: updateMessages(conv.messages),
            updatedAt: new Date(),
          }
        : conv
    );
    set({ conversations: updatedConversations });
  },

  addConversation: (conversation) => {
    const { conversations } = get();
    const updated = [...conversations, conversation];
    set({ conversations: updated });
    // Conversations are session-only, not persisted
  },

  updateConversation: (id, updates) => {
    const { conversations } = get();
    const updated = conversations.map((conv) =>
      conv.id === id ? { ...conv, ...updates } : conv
    );
    set({ conversations: updated });
    // Conversations are session-only, not persisted
  },

  setArtifacts: (artifacts) => set({ artifacts }),
  
  addArtifact: (artifact) => {
    const { artifacts } = get();
    set({ artifacts: [...artifacts, artifact] });
  },

  toggleStarAgent: (agentName) => {
    const { starredAgents } = get();
    const isStarred = starredAgents.includes(agentName);
    const updated = isStarred
      ? starredAgents.filter(name => name !== agentName)
      : [...starredAgents, agentName];
    set({ starredAgents: updated });
    get().saveStarredAgents();
  },

  isAgentStarred: (agentName) => {
    const { starredAgents } = get();
    return starredAgents.includes(agentName);
  },

  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error }),

  loadConversations: () => {
    // Conversations are session-only, start with empty array
    // Only load user preferences (selectedAgent, starredAgents)
    if (typeof window === 'undefined') return;
    
    try {
      const selectedAgentName = localStorage.getItem('selectedAgent');
      if (selectedAgentName) {
        const { agents } = get();
        const agent = agents.find((a) => a.name === selectedAgentName);
        if (agent) {
          set({ selectedAgent: agent });
        }
      }

      get().loadStarredAgents();
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  },

  saveConversations: () => {
    // Conversations are session-only, do not persist
    // This function is kept for API compatibility but does nothing
  },

  loadStarredAgents: () => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('adk-starred-agents');
      if (stored) {
        const starredAgents = JSON.parse(stored);
        set({ starredAgents });
      }
    } catch (error) {
      console.error('Error loading starred agents:', error);
    }
  },

  saveStarredAgents: () => {
    if (typeof window === 'undefined') return;
    
    try {
      const { starredAgents } = get();
      localStorage.setItem('adk-starred-agents', JSON.stringify(starredAgents));
    } catch (error) {
      console.error('Error saving starred agents:', error);
    }
  },

  addToolCall: (toolCall, messageId) => {
    const { activeTools, messageTools } = get();
    set({
      activeTools: {
        ...activeTools,
        [toolCall.id]: {
          ...toolCall,
          startTime: toolCall.startTime || new Date(),
        },
      },
      messageTools: {
        ...messageTools,
        [messageId]: [...(messageTools[messageId] || []), toolCall.id],
      },
    });
  },

  updateToolResponse: (toolId, response, error) => {
    const { activeTools } = get();
    const existing = activeTools[toolId];
    if (existing) {
      set({
        activeTools: {
          ...activeTools,
          [toolId]: {
            ...existing,
            status: error ? 'error' : 'completed',
            response,
            error,
            endTime: new Date(),
          },
        },
      });
    }
  },

  getToolsForMessage: (messageId) => {
    const { activeTools, messageTools } = get();
    const toolIds = messageTools[messageId] || [];
    return toolIds.map(id => activeTools[id]).filter(Boolean);
  },

  clearTools: () => {
    set({ activeTools: {}, messageTools: {} });
  },
}));

