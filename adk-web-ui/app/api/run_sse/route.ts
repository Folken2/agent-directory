import { NextRequest, NextResponse } from 'next/server';
import { getRateLimitIdentifier, checkRateLimit } from '@/lib/rate-limit';
import { trackAgentRun } from '@/lib/db-agent-runs';
import {
  ANONYMOUS_SESSION_COOKIE_NAME,
  readRunIdentityCookies,
} from '@/lib/analytics/run-identity';

const ADK_SERVER_URL = process.env.NEXT_PUBLIC_ADK_SERVER_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  // Create an AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for streaming

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

    // Ensure session exists before calling /run_sse (ADK server requires session to exist)
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

    // Use correct ADK endpoint: POST /run_sse
    // Convert new_message to Content format if it's a string
    const contentMessage = typeof new_message === 'string'
      ? { parts: [{ text: new_message }] }
      : new_message;

    const runAgentRequest = {
      app_name,
      user_id,
      session_id,
      new_message: contentMessage,
      streaming: streaming || true, // Default to true for SSE
      state_delta: state_delta || undefined,
      invocation_id: invocation_id || undefined,
    };

    console.log(`[API] Calling ADK server /run_sse for agent: ${app_name}, session: ${session_id}`);

    const response = await fetch(`${ADK_SERVER_URL}/run_sse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(runAgentRequest),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      // Track successful agent run completion (async, don't await)
      trackAgentRun(
        app_name,
        user_id,
        session_id,
        app_name,
        'completed',
        undefined,
        rateLimitId,
        runIdentity
      ).catch((error) =>
        console.error('Error tracking agent run completion:', error)
      );

      // Return the SSE stream directly from ADK server
      // Note: Can't set cookies in SSE stream response, but that's okay
      // Cookie will be set on next non-streaming request if needed
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control',
        },
      });
    }

    // Track failed agent run
    await trackAgentRun(
      app_name,
      user_id,
      session_id,
      app_name,
      'error',
      `ADK server returned status ${response.status}`,
      rateLimitId,
      runIdentity
    );

    const errorText = await response.text();
    console.error(`[API] ADK server returned ${response.status}:`, errorText);

    return NextResponse.json(
      { success: false, error: errorText || `ADK server returned status ${response.status}` },
      { status: response.status }
    );
  } catch (error: any) {
    clearTimeout(timeoutId);

    let errorMessage = error.message || 'Unknown error';

    // Provide more specific error messages
    if (error.name === 'AbortError') {
      errorMessage = 'Request timeout - ADK server did not respond within 60 seconds';
    } else if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED') || error.cause?.code === 'ECONNREFUSED') {
      errorMessage = `Cannot connect to ADK server at ${ADK_SERVER_URL}. Make sure the ADK server is running. Start it with: adk api_server`;
    } else if (error.message?.includes('ENOTFOUND') || error.cause?.code === 'ENOTFOUND') {
      errorMessage = `Cannot resolve hostname for ${ADK_SERVER_URL}. Check your network connection and server URL.`;
    }

    console.error('[API] Error calling ADK server /run_sse:', errorMessage, error);

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
