// ADK Server Client - Updated to match adk_web_server.py API
import axios, { AxiosInstance } from 'axios';
import {
  Agent,
  AgentsListResult,
  AgentsListSource,
  StreamChunk,
  ToolCall,
  ToolResponse,
} from './types';
import { parseGuideDocument } from './guide/parse';
import { parseBuild } from './build/parse';
import { BUILD_STATE_KEY } from './build/types';
import { parsePreviewState, PREVIEW_STATE_KEY } from './preview/types';
import { ChatApiError, errorFromResponse, friendlyMessage } from './api-error';

const API_BASE_URL = '';

/** Must exceed Next.js /api/agents cold-start wait (see ADK_LIST_APPS_* env on server). */
const LIST_AGENTS_CLIENT_TIMEOUT_MS = Math.max(
  30000,
  parseInt(process.env.NEXT_PUBLIC_ADK_LIST_AGENTS_CLIENT_TIMEOUT_MS || '180000', 10)
);

const DEBUG_STREAM = process.env.NEXT_PUBLIC_DEBUG_STREAM === 'true';
const debugLog = (...args: unknown[]) => { if (DEBUG_STREAM) console.log(...args); };

// Normalize base64 strings so we can safely display artifacts across different payload shapes
function sanitizeBase64String(value: string): string {
  // If the string is a full data URL, strip the prefix
  const commaIndex = value.indexOf(',');
  if (value.startsWith('data:') && commaIndex !== -1) {
    value = value.slice(commaIndex + 1);
  }

  // Normalise URL-safe base64 variants
  let cleaned = value.replace(/-/g, '+').replace(/_/g, '/');

  // Remove whitespace and any characters outside the base64 alphabet
  cleaned = cleaned.replace(/\s/g, '').replace(/[^A-Za-z0-9+/=]/g, '');

  // Remove existing padding then add the correct amount back
  cleaned = cleaned.replace(/=+$/, '');
  const remainder = cleaned.length % 4;
  if (remainder > 0) {
    cleaned += '='.repeat(4 - remainder);
  }

  return cleaned;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 1024;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function toBase64String(raw: any): string | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'string') {
    return sanitizeBase64String(raw);
  }

  if (raw instanceof ArrayBuffer) {
    return bytesToBase64(new Uint8Array(raw));
  }

  if (raw instanceof Uint8Array) {
    return bytesToBase64(raw);
  }

  if (Array.isArray(raw)) {
    return bytesToBase64(Uint8Array.from(raw));
  }

  if (typeof raw === 'object') {
    if ('data' in raw) {
      return toBase64String((raw as any).data);
    }
    if ('bytes' in raw) {
      return toBase64String((raw as any).bytes);
    }
  }

  return null;
}

// Helper function to extract inline data from artifact part (handles both camelCase and snake_case)
function extractInlineDataFromPart(part: any): { data: string; mimeType: string; filename?: string } | null {
  const source = part.inlineData || part.inline_data;
  if (!source) {
    return null;
  }

  const mimeType = source.mimeType || source.mime_type || 'application/octet-stream';
  const filename = source.filename;
  const dataString = toBase64String(source.data);

  if (!dataString) {
    return null;
  }

  return {
    data: dataString,
    mimeType,
    filename,
  };
}

class ADKClient {
  private client: AxiosInstance;

  constructor(baseURL: string = API_BASE_URL) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * List all available agents (apps)
   * Endpoint: GET /list-apps (via /api/agents proxy)
   *
   * Cold-start hardening lives on the Next.js `/api/agents` route (last-good
   * cache + offline catalog). This client never invents a stale singleton list.
   */
  async listAgents(): Promise<Agent[]> {
    const { agents } = await this.listAgentsDetailed();
    return agents;
  }

  async listAgentsDetailed(): Promise<AgentsListResult> {
    try {
      const endpoint = '/api/agents';
      const response = await this.client.get(endpoint, {
        timeout: LIST_AGENTS_CLIENT_TIMEOUT_MS,
      });

      const payload = response.data;
      const data = payload?.data ? payload.data : payload;
      const source = normalizeAgentsSource(payload?.source);
      const warning = typeof payload?.warning === 'string' ? payload.warning : undefined;
      const stale = Boolean(payload?.stale);

      if (data && Array.isArray(data)) {
        const agents = data.map((item: string | Agent) => {
          if (typeof item === 'string') {
            return {
              name: item,
              description: `Agent: ${item}`,
              tools: [],
              tags: [],
              useCases: [],
              samplePrompts: [],
            };
          }
          return {
            ...item,
            tags: item.tags ?? [],
            useCases: item.useCases ?? [],
            samplePrompts: item.samplePrompts ?? [],
          };
        });
        return { agents, source, stale, warning };
      }

      return { agents: [], source, stale, warning };
    } catch (error) {
      console.error('Error listing agents:', error);
      return {
        agents: [],
        source: undefined,
        stale: true,
        warning: 'Could not load the agent directory. Please try again in a moment.',
      };
    }
  }

  /**
   * Get agent information
   */
  async getAgentInfo(agentName: string): Promise<Agent | null> {
    try {
      const agents = await this.listAgents();
      return agents.find((a) => a.name === agentName) || null;
    } catch (error) {
      console.error('Error getting agent info:', error);
      return null;
    }
  }

  /**
   * Extract function calls from an event
   */
  private extractFunctionCalls(eventData: any): ToolCall[] {
    const functionCalls: ToolCall[] = [];

    // google-adk 2.x streams a call's arguments in partial events
    // (willContinue / partialArgs, no args) before the final event that
    // carries the complete call. Only the final one is a tool call.
    if (eventData?.partial === true) return functionCalls;

    // Check content.parts first (ADK structure)
    if (eventData.content && typeof eventData.content === 'object' && eventData.content.parts && Array.isArray(eventData.content.parts)) {
      for (const part of eventData.content.parts) {
        // Check both snake_case and camelCase versions
        const fc = part.function_call || part.functionCall;
        if (fc) {
          debugLog('[ADK Client] Found function_call in content.parts:', fc);
          functionCalls.push({
            id: fc.id || `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: fc.name || 'unknown',
            args: fc.args || {},
            status: 'pending',
          });
        }
      }
    } else if (eventData.parts && Array.isArray(eventData.parts)) {
      // Fallback for direct parts
      for (const part of eventData.parts) {
        const fc = part.function_call || part.functionCall;
        if (fc) {
          debugLog('[ADK Client] Found function_call in parts:', fc);
          functionCalls.push({
            id: fc.id || `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: fc.name || 'unknown',
            args: fc.args || {},
            status: 'pending',
          });
        }
      }
    }

    return functionCalls;
  }

  /**
   * Extract function responses from an event
   */
  private extractFunctionResponses(eventData: any): ToolResponse[] {
    const functionResponses: ToolResponse[] = [];

    // Check content.parts first (ADK structure)
    if (eventData.content && typeof eventData.content === 'object' && eventData.content.parts && Array.isArray(eventData.content.parts)) {
      for (const part of eventData.content.parts) {
        // Check both snake_case and camelCase versions
        const fr = part.function_response || part.functionResponse;
        if (fr) {
          debugLog('[ADK Client] Found function_response in content.parts:', fr);
          functionResponses.push({
            id: fr.id || `response-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: fr.name || 'unknown',
            response: fr.response,
            error: fr.error,
          });
        }
      }
    } else if (eventData.parts && Array.isArray(eventData.parts)) {
      // Fallback for direct parts
      for (const part of eventData.parts) {
        const fr = part.function_response || part.functionResponse;
        if (fr) {
          debugLog('[ADK Client] Found function_response in parts:', fr);
          functionResponses.push({
            id: fr.id || `response-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: fr.name || 'unknown',
            response: fr.response,
            error: fr.error,
          });
        }
      }
    }

    return functionResponses;
  }

  /**
   * Stream agent response using Server-Sent Events
   * Endpoint: POST /run_sse
   */
  async *streamAgent(
    agentName: string,
    message: string | { parts: Array<{ text?: string; inline_data?: any }> },
    sessionId: string | undefined,
    signal?: AbortSignal
  ): AsyncGenerator<StreamChunk> {
    // The server creates the ADK session and derives the user id itself.
    const actualSessionId =
      sessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const contentMessage = typeof message === 'string' ? { parts: [{ text: message }] } : message;
    yield* this.streamFrom(
      '/api/run_sse',
      { app_name: agentName, session_id: actualSessionId, new_message: contentMessage },
      signal
    );
  }

  /**
   * Stream a message to the live preview of the agent the builder is
   * building (the builder chat's `builderSessionId`). Same ADK event stream,
   * relayed by /api/preview from the sandbox.
   */
  async *streamPreview(
    builderSessionId: string,
    previewSessionId: string,
    text: string,
    signal?: AbortSignal
  ): AsyncGenerator<StreamChunk> {
    yield* this.streamFrom(
      `/api/preview?session_id=${encodeURIComponent(builderSessionId)}`,
      { previewSessionId, text },
      signal
    );
  }

  /** POST `body` to a same-origin SSE route and parse the ADK event stream. */
  private async *streamFrom(url: string, body: unknown, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        throw await errorFromResponse(response);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let textChunkCount = 0; // Track how many text chunks we yield

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const eventData = JSON.parse(line.slice(6));

                if (typeof eventData.error_code === 'string') {
                  yield {
                    type: 'error',
                    error: typeof eventData.error === 'string' ? eventData.error : friendlyMessage(eventData.error_code),
                    code: eventData.error_code,
                  };
                  continue;
                }

                // Debug: Log event structure to understand what we're receiving
                if (eventData.content?.parts || eventData.parts) {
                  debugLog('[ADK Client] Event received:', {
                    hasContent: !!eventData.content,
                    hasParts: !!eventData.parts,
                    contentParts: eventData.content?.parts?.length || 0,
                    directParts: eventData.parts?.length || 0,
                    longRunningToolIds: eventData.long_running_tool_ids,
                    eventId: eventData.id,
                  });

                  // Log the actual parts structure to see what's inside
                  if (eventData.content?.parts) {
                    debugLog('[ADK Client] Content parts:', eventData.content.parts);
                    eventData.content.parts.forEach((part: any, index: number) => {
                      debugLog(`[ADK Client] Part ${index}:`, {
                        hasText: !!part.text,
                        hasFunctionCall: !!part.function_call,
                        hasFunctionResponse: !!part.function_response,
                        hasInlineData: !!part.inline_data,
                        keys: Object.keys(part),
                      });
                      if (part.function_call) {
                        debugLog(`[ADK Client] Part ${index} function_call:`, part.function_call);
                      }
                      if (part.function_response) {
                        debugLog(`[ADK Client] Part ${index} function_response:`, part.function_response);
                      }
                    });
                  }
                }

                // Extract function calls and responses first
                const functionCalls = this.extractFunctionCalls(eventData);
                const functionResponses = this.extractFunctionResponses(eventData);

                if (functionCalls.length > 0) {
                  debugLog('[ADK Client] Found function calls:', functionCalls);
                }
                if (functionResponses.length > 0) {
                  debugLog('[ADK Client] Found function responses:', functionResponses);
                }

                // Yield tool calls
                for (const toolCall of functionCalls) {
                  // Check if it's a long-running tool
                  let isLongRunning = false;
                  if (eventData.long_running_tool_ids) {
                    if (Array.isArray(eventData.long_running_tool_ids)) {
                      isLongRunning = eventData.long_running_tool_ids.includes(toolCall.id);
                    } else if (typeof eventData.long_running_tool_ids === 'object') {
                      // Handle Set-like objects or plain objects
                      isLongRunning = toolCall.id in eventData.long_running_tool_ids ||
                        (eventData.long_running_tool_ids.has && eventData.long_running_tool_ids.has(toolCall.id));
                    }
                  }

                  yield {
                    type: 'toolCall',
                    toolCall: {
                      ...toolCall,
                      status: isLongRunning ? 'running' : 'pending',
                    },
                    author: eventData.author,
                  };
                }

                // Yield tool responses
                for (const toolResponse of functionResponses) {
                  yield { type: 'toolResponse', toolResponse, author: eventData.author };
                }

                // Surface Google Maps grounding captures from session state_delta.
                // The maps_specialist's after_model_callback writes to
                // state["maps:captures"] on each google_maps_grounding call;
                // the most recently appended entry is what this event added.
                const stateDelta = eventData.actions?.state_delta || eventData.actions?.stateDelta;
                const captures = stateDelta?.['maps:captures'];
                if (Array.isArray(captures) && captures.length > 0) {
                  const latest = captures[captures.length - 1];
                  yield {
                    type: 'mapsCapture',
                    mapsCapture: {
                      token: latest?.token ?? null,
                      places: Array.isArray(latest?.places) ? latest.places : [],
                      captured_at: latest?.captured_at ?? new Date().toISOString(),
                    },
                    author: eventData.author,
                  };
                }

                // Surface the guide_agent's structured document once it lands
                // in state["guide:document"] (see backend guide tool output_key).
                const guideRaw = stateDelta?.['guide:document'];
                if (guideRaw) {
                  const doc = parseGuideDocument(guideRaw);
                  if (doc) {
                    yield { type: 'guideDocument', guideDocument: doc, author: eventData.author };
                  }
                }

                // The builder packaged a project (package_agent writes state["builder:build"]).
                const buildRaw = stateDelta?.[BUILD_STATE_KEY];
                if (buildRaw) {
                  const build = parseBuild(buildRaw);
                  if (build) yield { type: 'build', build, author: eventData.author };
                }

                // The builder started or stopped a live preview (tools/sandbox_tools.py).
                const previewRaw = stateDelta?.[PREVIEW_STATE_KEY];
                if (previewRaw) {
                  const preview = parsePreviewState(previewRaw);
                  if (preview) yield { type: 'preview', preview, author: eventData.author };
                }

                // Handle Event object - check content.parts first (ADK structure)
                if (eventData.content && typeof eventData.content === 'object' && eventData.content.parts && Array.isArray(eventData.content.parts)) {
                  for (const part of eventData.content.parts) {
                    // Skip function_call and function_response as they're already handled above
                    if (part.function_call || part.functionCall || part.function_response || part.functionResponse) {
                      continue;
                    }
                    if (part.text) {
                      // Ensure text is a string
                      const text = typeof part.text === 'string' ? part.text : JSON.stringify(part.text);
                      // Check if this is a thinking/reasoning part
                      // Models flag thinking via: thought (Gemini), thinking, is_thought
                      // Parts with thoughtSignature are also thinking markers
                      const isThought = part.thought === true || part.thinking === true
                        || part.is_thought === true || 'thoughtSignature' in part;
                      if (isThought) {
                        debugLog(`[ADK Client] Yielding thinking from content.parts (author=${eventData.author}), len=${text.length}, preview="${text.substring(0, 50)}..."`);
                        yield { type: 'thinking', content: text, author: eventData.author };
                      } else {
                        textChunkCount++;
                        debugLog(`[ADK Client] Yielding text #${textChunkCount} from content.parts (author=${eventData.author}), len=${text.length}, preview="${text.substring(0, 50)}..."`);
                        yield { type: 'text', content: text, author: eventData.author };
                      }
                    } else {
                      const inlineData = extractInlineDataFromPart(part);
                      if (inlineData && inlineData.data) {
                        const mimeType = inlineData.mimeType || 'image/png';
                        let type: 'image' | 'pdf' | 'document' | 'spreadsheet' | 'text' | 'file' = 'file';
                        if (mimeType.startsWith('image/')) {
                          type = 'image';
                        } else if (mimeType.includes('pdf')) {
                          type = 'pdf';
                        } else if (mimeType.includes('document') || mimeType.includes('word')) {
                          type = 'document';
                        } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
                          type = 'spreadsheet';
                        } else if (mimeType.includes('text')) {
                          type = 'text';
                        }

                        yield {
                          type: 'artifact',
                          artifact: {
                            id: `artifact-${Date.now()}`,
                            name: inlineData.filename || 'artifact',
                            type,
                            url: `data:${mimeType};base64,${inlineData.data}`,
                          },
                        };
                      }
                    }
                    // Skip function_call and function_response as they're already handled above
                  }
                } else if (eventData.parts) {
                  // Fallback for direct parts
                  for (const part of eventData.parts) {
                    // Skip function_call and function_response as they're already handled above
                    if (part.function_call || part.functionCall || part.function_response || part.functionResponse) {
                      continue;
                    }
                    if (part.text) {
                      // Ensure text is a string
                      const text = typeof part.text === 'string' ? part.text : JSON.stringify(part.text);
                      // Check if this is a thinking/reasoning part
                      const isThought = part.thought === true || part.thinking === true
                        || part.is_thought === true || 'thoughtSignature' in part;
                      if (isThought) {
                        debugLog(`[ADK Client] Yielding thinking from parts, len=${text.length}, preview="${text.substring(0, 50)}..."`);
                        yield { type: 'thinking', content: text };
                      } else {
                        textChunkCount++;
                        debugLog(`[ADK Client] Yielding text #${textChunkCount} from parts, len=${text.length}, preview="${text.substring(0, 50)}..."`);
                        yield { type: 'text', content: text };
                      }
                    } else {
                      const inlineData = extractInlineDataFromPart(part);
                      if (inlineData && inlineData.data) {
                        const mimeType = inlineData.mimeType || 'image/png';
                        let type: 'image' | 'pdf' | 'document' | 'spreadsheet' | 'text' | 'file' = 'file';
                        if (mimeType.startsWith('image/')) {
                          type = 'image';
                        } else if (mimeType.includes('pdf')) {
                          type = 'pdf';
                        } else if (mimeType.includes('document') || mimeType.includes('word')) {
                          type = 'document';
                        } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
                          type = 'spreadsheet';
                        } else if (mimeType.includes('text')) {
                          type = 'text';
                        }

                        yield {
                          type: 'artifact',
                          artifact: {
                            id: `artifact-${Date.now()}`,
                            name: inlineData.filename || 'artifact',
                            type,
                            url: `data:${mimeType};base64,${inlineData.data}`,
                          },
                        };
                      }
                    }
                    // Skip function_call and function_response as they're already handled above
                  }
                } else if (eventData.content) {
                  // Fallback for content field
                  const content = typeof eventData.content === 'string' ? eventData.content : JSON.stringify(eventData.content);
                  textChunkCount++;
                  debugLog(`[ADK Client] Yielding text #${textChunkCount} from content field (author=${eventData.author}), len=${content.length}, preview="${content.substring(0, 50)}..."`);
                  yield { type: 'text', content, author: eventData.author };
                }
              } catch (e) {
                // If parsing fails, treat as plain text
                const text = line.slice(6);
                if (text.trim()) {
                  textChunkCount++;
                  debugLog(`[ADK Client] Yielding text #${textChunkCount} from unparsed line, len=${text.length}`);
                  yield { type: 'text', content: text };
                }
              }
            } else if (line.trim() && !line.startsWith(':')) {
              // Non-SSE line. Never surface this raw text to the user — it
              // may contain upstream error bodies — just log it for diagnostics.
              if (line.includes('error')) {
                debugLog('[ADK Client] Non-SSE line containing "error":', line);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Log buffer state at end of stream (don't process to avoid duplicates)
      if (buffer.trim()) {
        debugLog('[ADK Client] Remaining buffer at stream end (NOT processing):', buffer.substring(0, 200));
      }

      debugLog(`[ADK Client] Stream complete. Total text chunks yielded: ${textChunkCount}`);
      yield { type: 'done' };
    } catch (error: any) {
      // User-initiated abort isn't a real error: re-throw so the consumer's
      // catch can commit the partial response, but skip the noisy log.
      const isAbort =
        error?.name === 'AbortError' ||
        signal?.aborted ||
        error?.message?.toLowerCase?.()?.includes('aborted');
      if (isAbort) {
        throw error;
      }
      if (error instanceof ChatApiError) throw error;
      console.error('Error streaming agent:', error);
      yield { type: 'error', error: friendlyMessage('backend_unavailable'), code: 'backend_unavailable' };
    }
  }
}

export const adkClient = new ADKClient();

function normalizeAgentsSource(value: unknown): AgentsListSource | undefined {
  if (value === 'live' || value === 'cache' || value === 'catalog') return value;
  return undefined;
}
