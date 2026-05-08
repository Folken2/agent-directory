// Zustand store for global UI state.
//
// Scope (deliberately small):
//   - `agents`: cached agent directory (populated lazily by /chat or AgentGrid)
//   - `selectedAgent`: which agent the user is currently looking at
//   - `currentConversation`: the conversation in view, including its messages
//   - `artifacts`: artifacts emitted by the in-flight assistant turn
//   - `starredAgents`: persisted to localStorage
//   - tool tracking state for the streaming UI
//
// What this store deliberately does NOT hold:
//   - A list of past conversations. For authenticated users that lives in
//     Postgres and is fetched via /api/me/sessions; for anonymous users it
//     simply doesn't exist (one-shot chat per tab session). Keeping a parallel
//     in-memory list caused cross-agent leakage in the sidebar and forced
//     awkward dedup logic everywhere — see lib/sessions.ts for the canonical
//     read path.
import { create } from 'zustand';
import { Agent, Message, ChatConversation, Artifact, ToolStatus } from './types';

interface AppState {
  agents: Agent[];
  selectedAgent: Agent | null;
  currentConversation: ChatConversation | null;
  artifacts: Artifact[];
  starredAgents: string[];
  isLoading: boolean;
  error: string | null;
  activeTools: Record<string, ToolStatus>;
  messageTools: Record<string, string[]>;

  setAgents: (agents: Agent[]) => void;
  setSelectedAgent: (agent: Agent | null) => void;
  setCurrentConversation: (conversation: ChatConversation | null) => void;
  /** Patch the currentConversation in place (e.g. to update a title). */
  patchCurrentConversation: (updates: Partial<ChatConversation>) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  setArtifacts: (artifacts: Artifact[]) => void;
  addArtifact: (artifact: Artifact) => void;
  toggleStarAgent: (agentName: string) => void;
  isAgentStarred: (agentName: string) => boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  /**
   * Hydrate user preferences from localStorage (selectedAgent, starredAgents).
   * Safe to call repeatedly; idempotent.
   */
  loadPreferences: () => void;
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
  artifacts: [],
  starredAgents: [],
  isLoading: false,
  error: null,
  activeTools: {},
  messageTools: {},

  setAgents: (agents) => set({ agents }),

  setSelectedAgent: (agent) => {
    set({ selectedAgent: agent });
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedAgent', agent?.name || '');
    }
  },

  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),

  patchCurrentConversation: (updates) => {
    const { currentConversation } = get();
    if (!currentConversation) return;
    set({
      currentConversation: {
        ...currentConversation,
        ...updates,
        updatedAt: new Date(),
      },
    });
  },

  addMessage: (message) => {
    const { currentConversation } = get();
    if (!currentConversation) return;
    set({
      currentConversation: {
        ...currentConversation,
        messages: [...currentConversation.messages, message],
        updatedAt: new Date(),
      },
    });
  },

  updateMessage: (messageId, updates) => {
    const { currentConversation } = get();
    if (!currentConversation) return;
    set({
      currentConversation: {
        ...currentConversation,
        messages: currentConversation.messages.map((m) =>
          m.id === messageId ? { ...m, ...updates } : m
        ),
        updatedAt: new Date(),
      },
    });
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
      ? starredAgents.filter((name) => name !== agentName)
      : [...starredAgents, agentName];
    set({ starredAgents: updated });
    get().saveStarredAgents();
  },

  isAgentStarred: (agentName) => {
    return get().starredAgents.includes(agentName);
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  loadPreferences: () => {
    if (typeof window === 'undefined') return;
    try {
      const selectedAgentName = localStorage.getItem('selectedAgent');
      if (selectedAgentName) {
        const agent = get().agents.find((a) => a.name === selectedAgentName);
        if (agent) set({ selectedAgent: agent });
      }
      get().loadStarredAgents();
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  },

  loadStarredAgents: () => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('adk-starred-agents');
      if (stored) set({ starredAgents: JSON.parse(stored) });
    } catch (error) {
      console.error('Error loading starred agents:', error);
    }
  },

  saveStarredAgents: () => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('adk-starred-agents', JSON.stringify(get().starredAgents));
    } catch (error) {
      console.error('Error saving starred agents:', error);
    }
  },

  addToolCall: (toolCall, messageId) => {
    const { activeTools, messageTools } = get();
    const existingIds = messageTools[messageId] || [];
    const alreadyTracked = existingIds.includes(toolCall.id);
    set({
      activeTools: {
        ...activeTools,
        [toolCall.id]: {
          // Preserve any prior status (e.g. 'completed' from an earlier event)
          ...activeTools[toolCall.id],
          ...toolCall,
          startTime: activeTools[toolCall.id]?.startTime || toolCall.startTime || new Date(),
        },
      },
      messageTools: alreadyTracked
        ? messageTools
        : { ...messageTools, [messageId]: [...existingIds, toolCall.id] },
    });
  },

  updateToolResponse: (toolId, response, error) => {
    const { activeTools } = get();
    const existing = activeTools[toolId];
    if (!existing) return;
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
  },

  getToolsForMessage: (messageId) => {
    const { activeTools, messageTools } = get();
    const toolIds = messageTools[messageId] || [];
    return toolIds.map((id) => activeTools[id]).filter(Boolean);
  },

  clearTools: () => {
    set({ activeTools: {}, messageTools: {} });
  },
}));
