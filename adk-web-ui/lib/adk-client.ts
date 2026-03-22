// ADK Server Client - Updated to match adk_web_server.py API
import axios, { AxiosInstance } from 'axios';
import { Agent, AgentRun, Artifact, StreamChunk, ToolCall, ToolResponse } from './types';

const ADK_SERVER_URL = process.env.NEXT_PUBLIC_ADK_SERVER_URL || 'http://localhost:8000';

// Use Next.js API routes as proxy when running in browser
const USE_API_PROXY = typeof window !== 'undefined';
const API_BASE_URL = USE_API_PROXY ? '' : ADK_SERVER_URL;

// RunAgentRequest format matching adk_web_server.py
interface RunAgentRequest {
  app_name: string;
  user_id: string;
  session_id: string;
  new_message: string | { parts: Array<{ text?: string; inline_data?: any }> };
  streaming?: boolean;
  state_delta?: Record<string, any>;
  invocation_id?: string;
}

// Session structure
interface Session {
  id: string;
  app_name: string;
  user_id: string;
  state?: Record<string, any>;
  events?: any[];
}

// Event structure from ADK
interface Event {
  id?: string;
  author?: string;
  content?: string | { parts: any[]; role: string };
  parts?: any[];
  actions?: any;
  modelVersion?: string;
  partial?: boolean;
  finishReason?: string;
  usageMetadata?: any;
  invocationId?: string;
  longRunningToolIds?: any[];
  timestamp?: number;
}

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
  private defaultUserId: string = 'default-user';
  private defaultSessionId: string = '';

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
   */
  async listAgents(): Promise<Agent[]> {
    try {
      // Use Next.js API route as proxy when in browser
      const endpoint = USE_API_PROXY ? '/api/agents' : '/list-apps';
      const response = await this.client.get(endpoint);

      // If using proxy, extract data from response
      const data = USE_API_PROXY && response.data?.data ? response.data.data : response.data;

      if (data && Array.isArray(data)) {
        // Convert list of strings to Agent objects (if from /list-apps)
        // or use Agent objects directly (if from proxy)
        return data.map((item: string | Agent) => {
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
            useCases: (item as any).useCases ?? (item as any).use_cases ?? [],
            samplePrompts: (item as any).samplePrompts ?? (item as any).sample_prompts ?? [],
          };
        });
      }

      return [];
    } catch (error) {
      console.error('Error listing agents:', error);
      // Fallback: return hardcoded agents from the project
      return [
        {
          name: 'image_agent',
          description: 'AI assistant that generates images based on a prompt',
          tools: ['generate_image', 'load_artifacts'],
          tags: [],
          useCases: [],
          samplePrompts: [],
        },
        {
          name: 'simple_agent_web_search_EXA',
          description: 'AI assistant that grounds answers using web search and always cites sources',
          tools: ['web_search_async'],
          tags: [],
          useCases: [],
          samplePrompts: [],
        },
        {
          name: 'simple_agent_web_search',
          description: 'AI assistant that grounds answers using web search and always cites sources',
          tools: ['google_search'],
          tags: [],
          useCases: [],
          samplePrompts: [],
        },
      ];
    }
  }

  /**
   * Get agent information
   */
  async getAgentInfo(agentName: string): Promise<Agent | null> {
    try {
      // Get from list
      const agents = await this.listAgents();
      return agents.find(a => a.name === agentName) || null;
    } catch (error) {
      console.error('Error getting agent info:', error);
      return null;
    }
  }

  /**
   * Create or get a session
   * Endpoint: POST /apps/{app_name}/users/{user_id}/sessions
   */
  async createOrGetSession(
    appName: string,
    userId: string = this.defaultUserId,
    sessionId?: string
  ): Promise<Session> {
    try {
      // Generate session ID if not provided
      const actualSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      if (USE_API_PROXY) {
        // When using proxy, always create session via API route
        try {
          // Try to get existing session first
          if (sessionId) {
            try {
              const getResponse = await this.client.get(
                `/api/sessions?app_name=${appName}&user_id=${userId}&session_id=${sessionId}`
              );
              if (getResponse.data?.success && getResponse.data?.data) {
                return getResponse.data.data;
              }
            } catch (e: any) {
              // If session doesn't exist, continue to create it
              if (e.response?.status !== 404) {
                console.warn('Error checking for existing session:', e);
              }
            }
          }

          // Create new session via API proxy
          const createResponse = await this.client.post('/api/sessions', {
            app_name: appName,
            user_id: userId,
            session_id: actualSessionId,
          });

          if (createResponse.data?.success && createResponse.data?.data) {
            return createResponse.data.data;
          }

          // Fallback if API doesn't return expected format
          return {
            id: actualSessionId,
            app_name: appName,
            user_id: userId,
            state: {},
            events: [],
          };
        } catch (error: any) {
          console.error('Error creating session via proxy:', error);
          // Return session object anyway - the /run endpoint will handle the error
          return {
            id: actualSessionId,
            app_name: appName,
            user_id: userId,
            state: {},
            events: [],
          };
        }
      } else {
        // Direct connection to ADK server
        if (sessionId) {
          // Try to get existing session
          try {
            const response = await this.client.get(
              `/apps/${appName}/users/${userId}/sessions/${sessionId}`
            );
            if (response.data) {
              return response.data;
            }
          } catch (e: any) {
            if (e.response?.status !== 404) {
              throw e;
            }
          }
        }

        // Create new session
        const response = await this.client.post(
          `/apps/${appName}/users/${userId}/sessions`,
          { session_id: actualSessionId }
        );
        return response.data;
      }
    } catch (error: any) {
      console.error('Error creating/getting session:', error);
      // Return a default session object
      return {
        id: sessionId || `session-${Date.now()}`,
        app_name: appName,
        user_id: userId,
        state: {},
        events: [],
      };
    }
  }

  /**
   * Run an agent with a message (non-streaming)
   * Endpoint: POST /run
   */
  async runAgent(
    agentName: string,
    message: string | { parts: Array<{ text?: string; inline_data?: any }> },
    userId: string = this.defaultUserId,
    sessionId?: string
  ): Promise<AgentRun> {
    try {
      // Ensure we have a session
      const session = await this.createOrGetSession(agentName, userId, sessionId);
      const actualSessionId = session.id;

      // Prepare RunAgentRequest
      // Convert message to Content format (Google GenAI Content type)
      const contentMessage = typeof message === 'string'
        ? { parts: [{ text: message }] }
        : message;

      const request: RunAgentRequest = {
        app_name: agentName,
        user_id: userId,
        session_id: actualSessionId,
        new_message: contentMessage,
        streaming: false,
      };

      // Use Next.js API route as proxy when in browser
      if (USE_API_PROXY) {
        // Use simplified request format for proxy
        // Convert message to Content format
        const contentMessage = typeof message === 'string'
          ? { parts: [{ text: message }] }
          : message;

        const proxyRequest = {
          app_name: agentName,
          user_id: userId,
          session_id: actualSessionId,
          new_message: contentMessage,
          streaming: false,
        };
        const response = await this.client.post('/api/run', proxyRequest);

        if (response.data?.success && response.data?.data) {
          const result = response.data.data;
          return {
            id: result.id || `run-${Date.now()}`,
            agentName: result.agentName || agentName,
            message: result.message || message,
            response: result.response || '',
            artifacts: result.artifacts || [],
            status: result.status || 'completed',
          };
        }
        
        // Check for rate limit error
        if (response.status === 429 || response.data?.rateLimit) {
          const error = new Error(response.data?.error || 'Rate limit exceeded') as any;
          error.status = 429;
          error.rateLimit = response.data?.rateLimit;
          throw error;
        }
        
        throw new Error(response.data?.error || 'Failed to run agent');
      }

      const response = await this.client.post('/run', request);

      if (response.data && (Array.isArray(response.data) || typeof response.data === 'object')) {
        // Response is list[Event] or single Event object
        const events: Event[] = Array.isArray(response.data) ? response.data : [response.data];

        // Extract text content from events
        let responseText = '';
        const artifacts: Artifact[] = [];

        for (const event of events) {
          // Check for content.parts first (ADK server structure)
          if (event.content && typeof event.content === 'object' && event.content.parts && Array.isArray(event.content.parts)) {
            for (const part of event.content.parts) {
              if (part.text) {
                // Ensure text is a string
                const text = typeof part.text === 'string' ? part.text : JSON.stringify(part.text);
                responseText += text + '\n';
              } else {
                const inlineData = extractInlineDataFromPart(part);
                if (inlineData && inlineData.data) {
                  const mimeType = inlineData.mimeType;
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

                  artifacts.push({
                    id: `artifact-${Date.now()}`,
                    name: inlineData.filename || 'artifact',
                    type,
                    url: `data:${mimeType};base64,${inlineData.data}`,
                    runId: actualSessionId,
                  });
                }
              }
            }
          } else if (event.parts && Array.isArray(event.parts)) {
            // Fallback for direct parts field
            for (const part of event.parts) {
              if (part.text) {
                // Ensure text is a string
                const text = typeof part.text === 'string' ? part.text : JSON.stringify(part.text);
                responseText += text + '\n';
              } else {
                const inlineData = extractInlineDataFromPart(part);
                if (inlineData && inlineData.data) {
                  const mimeType = inlineData.mimeType;
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

                  artifacts.push({
                    id: `artifact-${Date.now()}`,
                    name: inlineData.filename || 'artifact',
                    type,
                    url: `data:${mimeType};base64,${inlineData.data}`,
                    runId: actualSessionId,
                  });
                }
              }
            }
          } else if (event.content) {
            // Fallback for content field
            const content = typeof event.content === 'string' ? event.content : JSON.stringify(event.content);
            responseText += content + '\n';
          }
        }

        // Convert message to string for AgentRun interface
        const messageString = typeof message === 'string'
          ? message
          : message.parts?.map(part => part.text || '').join('') || '';

        return {
          id: `run-${Date.now()}`,
          agentName,
          message: messageString,
          response: responseText.trim(),
          artifacts,
          status: 'completed',
        };
      }

      throw new Error('Unexpected response format');
    } catch (error: any) {
      console.error('Error running agent:', error);
      
      // Re-throw rate limit errors so they can be handled specially
      // Check both direct status and axios response status
      if (error?.status === 429 || error?.response?.status === 429) {
        // Attach rate limit info to error if available
        if (error?.response?.data?.rateLimit) {
          error.rateLimit = error.response.data.rateLimit;
        }
        throw error;
      }
      
      // Convert message to string for AgentRun interface
      const messageString = typeof message === 'string'
        ? message
        : message.parts?.map(part => part.text || '').join('') || '';

      return {
        id: `run-${Date.now()}`,
        agentName,
        message: messageString,
        status: 'error',
        error: error.message || 'Failed to run agent',
        rateLimit: error?.rateLimit || error?.response?.data?.rateLimit,
      };
    }
  }

  /**
   * Extract function calls from an event
   */
  private extractFunctionCalls(eventData: any): ToolCall[] {
    const functionCalls: ToolCall[] = [];

    // Check content.parts first (ADK structure)
    if (eventData.content && typeof eventData.content === 'object' && eventData.content.parts && Array.isArray(eventData.content.parts)) {
      for (const part of eventData.content.parts) {
        // Check both snake_case and camelCase versions
        const fc = part.function_call || part.functionCall;
        if (fc) {
          console.log('[ADK Client] Found function_call in content.parts:', fc);
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
          console.log('[ADK Client] Found function_call in parts:', fc);
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
          console.log('[ADK Client] Found function_response in content.parts:', fr);
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
          console.log('[ADK Client] Found function_response in parts:', fr);
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
    userId: string = this.defaultUserId,
    sessionId?: string
  ): AsyncGenerator<StreamChunk> {
    try {
      // Ensure we have a session
      const session = await this.createOrGetSession(agentName, userId, sessionId);
      const actualSessionId = session.id;

      // Prepare RunAgentRequest
      // Convert message to Content format
      const contentMessage = typeof message === 'string'
        ? { parts: [{ text: message }] }
        : message;

      const request: RunAgentRequest = {
        app_name: agentName,
        user_id: userId,
        session_id: actualSessionId,
        new_message: contentMessage,
        streaming: true,
      };

      // Use fetch for SSE streaming
      // When using proxy, use the Next.js API route for SSE
      const sseUrl = USE_API_PROXY ? '/api/run_sse' : `${ADK_SERVER_URL}/run_sse`;

      const response = await fetch(sseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        // For 429 errors, try to extract rate limit info from response
        if (response.status === 429) {
          try {
            const errorData = await response.clone().json();
            const error = new Error(`HTTP error! status: ${response.status}`) as any;
            error.status = 429;
            error.response = { status: 429, data: errorData };
            if (errorData.rateLimit) {
              error.rateLimit = errorData.rateLimit;
            }
            throw error;
          } catch (parseError) {
            // If parsing fails, throw regular error
            const error = new Error(`HTTP error! status: ${response.status}`) as any;
            error.status = 429;
            throw error;
          }
        }
        throw new Error(`HTTP error! status: ${response.status}`);
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

                // Debug: Log event structure to understand what we're receiving
                if (eventData.content?.parts || eventData.parts) {
                  console.log('[ADK Client] Event received:', {
                    hasContent: !!eventData.content,
                    hasParts: !!eventData.parts,
                    contentParts: eventData.content?.parts?.length || 0,
                    directParts: eventData.parts?.length || 0,
                    longRunningToolIds: eventData.long_running_tool_ids,
                    eventId: eventData.id,
                  });

                  // Log the actual parts structure to see what's inside
                  if (eventData.content?.parts) {
                    console.log('[ADK Client] Content parts:', eventData.content.parts);
                    eventData.content.parts.forEach((part: any, index: number) => {
                      console.log(`[ADK Client] Part ${index}:`, {
                        hasText: !!part.text,
                        hasFunctionCall: !!part.function_call,
                        hasFunctionResponse: !!part.function_response,
                        hasInlineData: !!part.inline_data,
                        keys: Object.keys(part),
                      });
                      if (part.function_call) {
                        console.log(`[ADK Client] Part ${index} function_call:`, part.function_call);
                      }
                      if (part.function_response) {
                        console.log(`[ADK Client] Part ${index} function_response:`, part.function_response);
                      }
                    });
                  }
                }

                // Extract function calls and responses first
                const functionCalls = this.extractFunctionCalls(eventData);
                const functionResponses = this.extractFunctionResponses(eventData);

                if (functionCalls.length > 0) {
                  console.log('[ADK Client] Found function calls:', functionCalls);
                }
                if (functionResponses.length > 0) {
                  console.log('[ADK Client] Found function responses:', functionResponses);
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
                    }
                  };
                }

                // Yield tool responses
                for (const toolResponse of functionResponses) {
                  yield { type: 'toolResponse', toolResponse };
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
                        console.log(`[ADK Client] Yielding thinking from content.parts, len=${text.length}, preview="${text.substring(0, 50)}..."`);
                        yield { type: 'thinking', content: text };
                      } else {
                        textChunkCount++;
                        console.log(`[ADK Client] Yielding text #${textChunkCount} from content.parts, len=${text.length}, preview="${text.substring(0, 50)}..."`);
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
                        console.log(`[ADK Client] Yielding thinking from parts, len=${text.length}, preview="${text.substring(0, 50)}..."`);
                        yield { type: 'thinking', content: text };
                      } else {
                        textChunkCount++;
                        console.log(`[ADK Client] Yielding text #${textChunkCount} from parts, len=${text.length}, preview="${text.substring(0, 50)}..."`);
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
                  console.log(`[ADK Client] Yielding text #${textChunkCount} from content field, len=${content.length}, preview="${content.substring(0, 50)}..."`);
                  yield { type: 'text', content };
                }
              } catch (e) {
                // If parsing fails, treat as plain text
                const text = line.slice(6);
                if (text.trim()) {
                  textChunkCount++;
                  console.log(`[ADK Client] Yielding text #${textChunkCount} from unparsed line, len=${text.length}`);
                  yield { type: 'text', content: text };
                }
              }
            } else if (line.trim() && !line.startsWith(':')) {
              // Non-SSE line, might be error
              if (line.includes('error')) {
                yield { type: 'error', error: line };
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Log buffer state at end of stream (don't process to avoid duplicates)
      if (buffer.trim()) {
        console.log('[ADK Client] Remaining buffer at stream end (NOT processing):', buffer.substring(0, 200));
      }

      console.log(`[ADK Client] Stream complete. Total text chunks yielded: ${textChunkCount}`);
      yield { type: 'done' };
    } catch (error: any) {
      console.error('Error streaming agent:', error);
      yield { type: 'error', error: error.message || 'Streaming failed' };
    }
  }

  /**
   * Get artifacts from a session
   * Endpoint: GET /apps/{app_name}/users/{user_id}/sessions/{session_id}/artifacts
   */
  async getArtifacts(
    appName: string,
    sessionId: string,
    userId: string = this.defaultUserId
  ): Promise<Artifact[]> {
    try {
      const response = await this.client.get(
        `/apps/${appName}/users/${userId}/sessions/${sessionId}/artifacts`
      );

      if (response.data && Array.isArray(response.data)) {
        // Response is list of artifact names
        const artifactNames: string[] = response.data;

        // Fetch each artifact
        const artifacts: Artifact[] = [];
        for (const artifactName of artifactNames) {
          try {
            const artifactResponse = await this.client.get(
              `/apps/${appName}/users/${userId}/sessions/${sessionId}/artifacts/${artifactName}`
            );

            if (artifactResponse.data) {
              const part = artifactResponse.data;
              const inlineData = extractInlineDataFromPart(part);
              if (inlineData) {
                artifacts.push({
                  id: artifactName,
                  name: artifactName,
                  type: inlineData.mimeType?.startsWith('image/') ? 'image' : 'file',
                  url: `data:${inlineData.mimeType};base64,${inlineData.data}`,
                  runId: sessionId,
                });
              }
            }
          } catch (e) {
            console.error(`Error loading artifact ${artifactName}:`, e);
          }
        }

        return artifacts;
      }

      return [];
    } catch (error) {
      console.error('Error getting artifacts:', error);
      return [];
    }
  }

  /**
   * Set default user ID
   */
  setDefaultUserId(userId: string) {
    this.defaultUserId = userId;
  }

  /**
   * Set default session ID
   */
  setDefaultSessionId(sessionId: string) {
    this.defaultSessionId = sessionId;
  }
}

export const adkClient = new ADKClient();
