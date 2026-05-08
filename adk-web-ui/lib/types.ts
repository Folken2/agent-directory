// TypeScript types for ADK Web UI

export interface UseCase {
  title: string;
  description: string;
}

export interface Agent {
  name: string; // Filesystem-safe name (e.g., "image_generation_agent")
  displayName?: string; // Optional display name (e.g., "Image Generation Agent")
  description: string;
  tools?: string[];
  starsCount?: number;
  runs?: number;
  lastRunAt?: string;
  tags?: string[];
  useCases?: UseCase[];
  samplePrompts?: string[];
  author?: string; // Agent creator
  githubUrl?: string; // Link to agent repository
  documentation?: string; // Link to documentation
  version?: string; // Agent version
  lastUpdated?: string; // Last update date
  logo?: string; // Logo/thumbnail URL for the agent
  category?: string;
  // Multi-agent declarations. When present, only `finalSubAgent` text streams
  // to the main bubble; other sub-agent text is routed to a progress block.
  finalSubAgent?: string;
}

export interface SubAgentStep {
  author: string;       // sub-agent name as emitted by ADK (e.g., "planner")
  content: string;      // accumulated text from this sub-agent (latest run only)
  status: 'running' | 'done';
  startedAt: number;    // ms epoch
  completedAt?: number;
  runIndex: number;     // 1, 2, 3 — increments when an author re-emits in a loop
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  timestamp: Date;
  agentName?: string;
  artifacts?: Artifact[];
  subAgentSteps?: SubAgentStep[];
  mapsCaptures?: MapsCapture[];
}

export interface Artifact {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'document' | 'spreadsheet' | 'text' | 'file';
  url: string;
  runId?: string;
}

export interface AgentRun {
  id: string;
  agentName: string;
  message: string;
  response?: string;
  artifacts?: Artifact[];
  status: 'pending' | 'running' | 'completed' | 'error';
  error?: string;
  rateLimit?: {
    exceeded: boolean;
    count: number;
    limit: number;
    userType: 'authenticated' | 'anonymous';
  };
}

export interface ChatConversation {
  id: string;
  title: string;
  agentName: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  // Set when a conversation is hydrated from a past ADK session — drives the
  // "Resumed from {date}" banner and signals that earlier turns aren't fully
  // re-rendered (text only, no artifacts/tool calls).
  resumedFrom?: Date;
}

export interface ADKApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface ToolResponse {
  id: string;
  name: string;
  response: any;
  error?: string;
}

export interface ToolStatus {
  id: string;
  name: string;
  args?: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'error';
  response?: any;
  error?: string;
  isLongRunning?: boolean;
  startTime?: Date;
  endTime?: Date;
}

export interface MapsPlace {
  place_id: string | null;
  title: string | null;
  uri: string | null;
}

export interface MapsCapture {
  token: string | null;
  places: MapsPlace[];
  captured_at: string;
}

export interface StreamChunk {
  type: 'text' | 'thinking' | 'artifact' | 'done' | 'error' | 'toolCall' | 'toolResponse' | 'mapsCapture';
  content?: string;
  artifact?: Artifact;
  error?: string;
  toolCall?: ToolCall;
  toolResponse?: ToolResponse;
  mapsCapture?: MapsCapture;
  author?: string;       // ADK event.author — which (sub-)agent produced this chunk
}

