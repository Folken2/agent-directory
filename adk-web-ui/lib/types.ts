// TypeScript types for ADK Web UI
import type { ConversationId, MessageId } from './ids';

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

/** Tool activity nested under a sub-agent step (Cursor-style timeline). */
export interface SubAgentTool {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'error';
  response?: unknown;
  error?: string;
}

export interface SubAgentStep {
  author: string;       // sub-agent name as emitted by ADK (e.g., "planner")
  content: string;      // accumulated text from this sub-agent (latest run only)
  thinking?: string;    // accumulated reasoning / CoT for this step
  tools?: SubAgentTool[];
  status: 'running' | 'done';
  startedAt: number;    // ms epoch
  completedAt?: number;
  runIndex: number;     // 1, 2, 3 — increments when an author re-emits in a loop
}

export interface Message {
  id: MessageId;
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
  id: ConversationId;
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

/**
 * One yield from `adkClient.streamAgent`. Discriminated by `type`, so each
 * branch carries only the fields it actually needs — TS will refuse to let
 * you read `chunk.toolCall` when `chunk.type === 'text'`. The `author` is
 * optional and applies to all branches that come from a model emission
 * (text/thinking); it identifies which (sub-)agent produced the chunk so
 * the streaming hook can route intermediate authors into the progress
 * feed instead of the main bubble.
 */
export type StreamChunk =
  | { type: 'text'; content: string; author?: string }
  | { type: 'thinking'; content: string; author?: string }
  | { type: 'artifact'; artifact: Artifact; author?: string }
  | { type: 'toolCall'; toolCall: ToolCall; author?: string }
  | { type: 'toolResponse'; toolResponse: ToolResponse; author?: string }
  | { type: 'mapsCapture'; mapsCapture: MapsCapture; author?: string }
  | { type: 'error'; error: string }
  | { type: 'done' };

