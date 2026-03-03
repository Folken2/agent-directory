// TypeScript types for ADK Web UI

export interface Agent {
  name: string; // Filesystem-safe name (e.g., "image_generation_agent")
  displayName?: string; // Optional display name (e.g., "Image Generation Agent")
  description: string;
  tools?: string[];
  starsCount?: number;
  runs?: number;
  lastRunAt?: string;
  tags?: string[];
  useCases?: string[];
  samplePrompts?: string[];
  author?: string; // Agent creator
  githubUrl?: string; // Link to agent repository
  documentation?: string; // Link to documentation
  version?: string; // Agent version
  lastUpdated?: string; // Last update date
  logo?: string; // Logo/thumbnail URL for the agent
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentName?: string;
  artifacts?: Artifact[];
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

export interface StreamChunk {
  type: 'text' | 'artifact' | 'done' | 'error' | 'toolCall' | 'toolResponse';
  content?: string;
  artifact?: Artifact;
  error?: string;
  toolCall?: ToolCall;
  toolResponse?: ToolResponse;
}

