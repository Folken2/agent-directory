import { NextRequest, NextResponse } from 'next/server';
import { trackAgentRun } from '@/lib/db-agent-runs';
import { getRateLimitIdentifier, checkRateLimit } from '@/lib/rate-limit';
import {
  ANONYMOUS_SESSION_COOKIE_NAME,
  readRunIdentityCookies,
} from '@/lib/analytics/run-identity';

const ADK_SERVER_URL = process.env.NEXT_PUBLIC_ADK_SERVER_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  // Create an AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for agent runs
  
  // Declare body outside try block so it's accessible in catch for error tracking
  let body: { app_name?: string; user_id?: string; session_id?: string; new_message?: string; streaming?: boolean; state_delta?: unknown; invocation_id?: string } | undefined;
  
  try {
    body = await request.json();
    const { app_name, user_id, session_id, new_message, streaming, state_delta, invocation_id } = body as NonNullable<typeof body>;

    if (!app_name || !user_id || !session_id || !new_message) {
      return NextResponse.json(
        { success: false, error: 'app_name, user_id, session_id, and new_message are required' },
        { status: 400 }
      );
    }

    // Check rate limit before proceeding
    const { identifier: rateLimitId, userType } = await getRateLimitIdentifier(request);
    const runIdentity = readRunIdentityCookies(request);
    const rateLimitCheck = await checkRateLimit(rateLimitId, userType);
    
    if (!rateLimitCheck.allowed) {
      const response = NextResponse.json(
        { 
          success: false, 
          error: rateLimitCheck.message,
          rateLimit: {
            exceeded: true,
            count: rateLimitCheck.count,
            limit: rateLimitCheck.limit,
            userType,
          }
        },
        { status: 429 }
      );
      
      // Set anonymous session cookie if user is anonymous
      if (userType === 'anonymous' && rateLimitId) {
        const isProduction = process.env.NODE_ENV === 'production';
        response.cookies.set(ANONYMOUS_SESSION_COOKIE_NAME, rateLimitId, {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 365, // 1 year
          path: '/',
        });
      }
      
      return response;
    }

    // Ensure session exists before calling /run (ADK server requires session to exist)
    const sessionCheckController = new AbortController();
    const sessionCheckTimeout = setTimeout(() => sessionCheckController.abort(), 2000);
    
    try {
      const sessionCheckResponse = await fetch(
        `${ADK_SERVER_URL}/apps/${app_name}/users/${user_id}/sessions/${session_id}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: sessionCheckController.signal,
        }
      );
      
      clearTimeout(sessionCheckTimeout);
      
      if (sessionCheckResponse.status === 404) {
        // Session doesn't exist, create it
        console.log(`[API] Session ${session_id} not found, creating it...`);
        const createController = new AbortController();
        const createTimeout = setTimeout(() => createController.abort(), 2000);
        
        try {
          const createSessionResponse = await fetch(
            `${ADK_SERVER_URL}/apps/${app_name}/users/${user_id}/sessions`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify({ session_id }),
              signal: createController.signal,
            }
          );
          
          clearTimeout(createTimeout);
          
          if (!createSessionResponse.ok) {
            const errorText = await createSessionResponse.text();
            console.error(`[API] Failed to create session: ${errorText}`);
            return NextResponse.json(
              { success: false, error: `Failed to create session: ${errorText}` },
              { status: createSessionResponse.status }
            );
          }
        } catch (createError: any) {
          clearTimeout(createTimeout);
          console.error('[API] Error creating session:', createError.message);
          return NextResponse.json(
            { success: false, error: `Failed to create session: ${createError.message}` },
            { status: 500 }
          );
        }
      } else if (!sessionCheckResponse.ok) {
        console.warn(`[API] Session check returned ${sessionCheckResponse.status}, continuing anyway...`);
      }
    } catch (sessionError: any) {
      clearTimeout(sessionCheckTimeout);
      
      // If session check fails, try to create session anyway
      console.warn('[API] Session check failed, attempting to create session:', sessionError.message);
      const createController = new AbortController();
      const createTimeout = setTimeout(() => createController.abort(), 2000);
      
      try {
        const createResponse = await fetch(
          `${ADK_SERVER_URL}/apps/${app_name}/users/${user_id}/sessions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({ session_id }),
            signal: createController.signal,
          }
        );
        clearTimeout(createTimeout);
        
        if (!createResponse.ok) {
          console.error('[API] Failed to create session after check failure');
          // Continue anyway - let ADK server handle the error
        }
      } catch (createError: any) {
        clearTimeout(createTimeout);
        console.error('[API] Failed to create session:', createError.message);
        // Continue anyway - let ADK server handle the error
      }
    }

    // Use correct ADK endpoint: POST /run
    // Convert new_message to Content format if it's a string
    const contentMessage = typeof new_message === 'string' 
      ? { parts: [{ text: new_message }] }
      : new_message;

    const runAgentRequest = {
      app_name,
      user_id,
      session_id,
      new_message: contentMessage,
      streaming: streaming || false,
      state_delta: state_delta || undefined,
      invocation_id: invocation_id || undefined,
    };

    console.log(`[API] Calling ADK server /run for agent: ${app_name}, session: ${session_id}`);

    // Track agent run start with rate limit identifier
    await trackAgentRun(
      app_name,
      user_id,
      session_id,
      app_name,
      'running',
      undefined,
      rateLimitId,
      runIdentity
    );

    const response = await fetch(`${ADK_SERVER_URL}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(runAgentRequest),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (response.ok) {
      const events = await response.json();
      
      // Parse events to extract response text and artifacts
      let responseText = '';
      const artifacts: any[] = [];

      // Handle both array of events and single event object
      const eventList = Array.isArray(events) ? events : [events];

      for (const event of eventList) {
        // Check for content.parts first (ADK server structure)
        if (event.content && event.content.parts && Array.isArray(event.content.parts)) {
          for (const part of event.content.parts) {
            if (part.text) {
              // Ensure text is a string
              const text = typeof part.text === 'string' ? part.text : JSON.stringify(part.text);
              responseText += text + '\n';
            } else if (part.inline_data) {
              const mimeType = part.inline_data.mime_type || '';
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
                name: part.inline_data.filename || 'artifact',
                type,
                url: `data:${mimeType};base64,${part.inline_data.data}`,
              });
            }
          }
        } else if (event.parts && Array.isArray(event.parts)) {
          // Fallback for direct parts field
          for (const part of event.parts) {
            if (part.text) {
              // Ensure text is a string
              const text = typeof part.text === 'string' ? part.text : JSON.stringify(part.text);
              responseText += text + '\n';
            } else if (part.inline_data) {
              const mimeType = part.inline_data.mime_type || '';
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
                name: part.inline_data.filename || 'artifact',
                type,
                url: `data:${mimeType};base64,${part.inline_data.data}`,
              });
            }
          }
        } else if (event.content) {
          // Fallback for content field
          const content = typeof event.content === 'string' ? event.content : JSON.stringify(event.content);
          responseText += content + '\n';
        } else if (event.actions && event.actions.artifactDelta) {
          // Check for artifacts in actions.artifactDelta
          console.log('[API] Found artifactDelta:', event.actions.artifactDelta);
          // Note: artifactDelta might contain artifact references, but we need to fetch the actual data
        }
      }

      // After processing the run, fetch any artifacts that may have been created
      let sessionArtifacts: any[] = [];
      try {
        console.log('[API] Fetching artifacts for session:', session_id, 'URL:', `${ADK_SERVER_URL}/apps/${app_name}/users/${user_id}/sessions/${session_id}/artifacts`);
        const artifactsController = new AbortController();
        const artifactsTimeout = setTimeout(() => artifactsController.abort(), 3000);

        const artifactsResponse = await fetch(
          `${ADK_SERVER_URL}/apps/${app_name}/users/${user_id}/sessions/${session_id}/artifacts`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
            signal: artifactsController.signal,
          }
        );

        console.log('[API] Artifacts response status:', artifactsResponse.status);
        clearTimeout(artifactsTimeout);

        if (artifactsResponse.ok) {
          const artifactNames = await artifactsResponse.json();
          console.log('[API] Found artifact names:', artifactNames, 'Type:', typeof artifactNames, 'IsArray:', Array.isArray(artifactNames));

          if (Array.isArray(artifactNames)) {
            for (const name of artifactNames) {
              try {
                console.log(`[API] Fetching individual artifact: ${name}`);
                const artifactController = new AbortController();
                const artifactTimeout = setTimeout(() => artifactController.abort(), 2000);

                const artifactResponse = await fetch(
                  `${ADK_SERVER_URL}/apps/${app_name}/users/${user_id}/sessions/${session_id}/artifacts/${name}`,
                  {
                    headers: {
                      'Accept': 'application/json',
                    },
                    signal: artifactController.signal,
                  }
                );

                console.log(`[API] Artifact ${name} response status:`, artifactResponse.status);
                clearTimeout(artifactTimeout);

                if (artifactResponse.ok) {
                  const part = await artifactResponse.json();
                  console.log(`[API] Artifact ${name} data keys:`, Object.keys(part));
                  if (part.inlineData || part.inline_data) {
                    const inlineData = part.inlineData || part.inline_data;
                    const mimeType = inlineData.mimeType || inlineData.mime_type || '';
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

                    // Use data URL - client-side component will convert to blob URL if needed
                    const url = `data:${mimeType};base64,${inlineData.data}`;
                    console.log('[API] Created data URL for artifact:', name, type, 'MIME type:', mimeType, 'URL length:', url.length);

                    sessionArtifacts.push({
                      id: name,
                      name: name,
                      type,
                      url,
                    });
                  } else {
                    console.log(`[API] Artifact ${name} has no inlineData or inline_data`);
                  }
                } else {
                  const errorText = await artifactResponse.text();
                  console.error(`[API] Failed to fetch artifact ${name}:`, artifactResponse.status, errorText);
                }
              } catch (artifactError: any) {
                console.error(`[API] Error loading artifact ${name}:`, artifactError.message);
              }
            }
          }
        } else {
          console.log('[API] No artifacts found or error fetching artifacts');
        }
      } catch (artifactsError: any) {
        console.error('[API] Error fetching session artifacts:', artifactsError.message);
      }

      // Combine artifacts from the run response with session artifacts
      const allArtifacts = [...artifacts, ...sessionArtifacts];
      console.log('[API] Total artifacts found:', allArtifacts.length);

      // Track successful agent run completion
      await trackAgentRun(
        app_name,
        user_id,
        session_id,
        app_name,
        'completed',
        undefined,
        rateLimitId,
        runIdentity
      );

      const successResponse = NextResponse.json({
        success: true,
        data: {
          id: `run-${Date.now()}`,
          agentName: app_name,
          message: typeof new_message === 'string' ? new_message : JSON.stringify(new_message),
          response: responseText.trim(),
          artifacts: allArtifacts,
          status: 'completed',
        },
      });

      // Set anonymous session cookie if user is anonymous
      if (userType === 'anonymous' && rateLimitId) {
        const isProduction = process.env.NODE_ENV === 'production';
        successResponse.cookies.set(ANONYMOUS_SESSION_COOKIE_NAME, rateLimitId, {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 365, // 1 year
          path: '/',
        });
      }

      return successResponse;
    }

    const errorText = await response.text();
    console.error(`[API] ADK server returned ${response.status}:`, errorText);
    
    // Track failed agent run
    await trackAgentRun(
      app_name,
      user_id,
      session_id,
      app_name,
      'error',
      errorText || `ADK server returned status ${response.status}`,
      rateLimitId,
      runIdentity
    );
    
    return NextResponse.json(
      { success: false, error: errorText || `ADK server returned status ${response.status}` },
      { status: response.status }
    );
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    let errorMessage = error.message || 'Unknown error';
    
    // Provide more specific error messages
    if (error.name === 'AbortError') {
      errorMessage = 'Request timeout - ADK server did not respond within 30 seconds';
    } else if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED') || error.cause?.code === 'ECONNREFUSED') {
      errorMessage = `Cannot connect to ADK server at ${ADK_SERVER_URL}. Make sure the ADK server is running. Start it with: adk api_server`;
    } else if (error.message?.includes('ENOTFOUND') || error.cause?.code === 'ENOTFOUND') {
      errorMessage = `Cannot resolve hostname for ${ADK_SERVER_URL}. Check your network connection and server URL.`;
    }
    
    console.error('[API] Error calling ADK server /run:', errorMessage, error);
    
    // Track error agent run (rateLimitId may not be available if error occurred before rate limit check)
    try {
      const { identifier: errorRateLimitId } = await getRateLimitIdentifier(request).catch(() => ({ identifier: null }));
      await trackAgentRun(
        body?.app_name || 'unknown',
        body?.user_id || 'unknown',
        body?.session_id || 'unknown',
        body?.app_name || 'unknown',
        'error',
        errorMessage,
        errorRateLimitId || undefined,
        readRunIdentityCookies(request)
      );
    } catch (trackError) {
      console.error('Error tracking failed run:', trackError);
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
