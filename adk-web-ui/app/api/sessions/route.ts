import { NextRequest, NextResponse } from 'next/server';

const ADK_SERVER_URL = process.env.NEXT_PUBLIC_ADK_SERVER_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  // Create an AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
  
  try {
    const body = await request.json();
    const { app_name, user_id, session_id } = body;

    if (!app_name || !user_id) {
      return NextResponse.json(
        { success: false, error: 'app_name and user_id are required' },
        { status: 400 }
      );
    }

    // Create session via ADK server
    const response = await fetch(
      `${ADK_SERVER_URL}/apps/${app_name}/users/${user_id}/sessions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(session_id ? { session_id } : {}),
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);

    if (response.ok) {
      const session = await response.json();
      return NextResponse.json({
        success: true,
        data: session,
      });
    }

    const errorText = await response.text();
    console.error(`[API] ADK server returned ${response.status} for session creation:`, errorText);
    
    return NextResponse.json(
      { success: false, error: errorText || `Failed to create session (status: ${response.status})` },
      { status: response.status }
    );
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    let errorMessage = error.message || 'Unknown error';
    
    // Provide more specific error messages
    if (error.name === 'AbortError') {
      errorMessage = 'Request timeout - ADK server did not respond within 5 seconds';
    } else if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED') || error.cause?.code === 'ECONNREFUSED') {
      errorMessage = `Cannot connect to ADK server at ${ADK_SERVER_URL}. Make sure the ADK server is running. Start it with: adk api_server`;
    } else if (error.message?.includes('ENOTFOUND') || error.cause?.code === 'ENOTFOUND') {
      errorMessage = `Cannot resolve hostname for ${ADK_SERVER_URL}. Check your network connection and server URL.`;
    }
    
    console.error('[API] Error creating session:', errorMessage, error);
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Create an AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const app_name = searchParams.get('app_name');
    const user_id = searchParams.get('user_id');
    const session_id = searchParams.get('session_id');

    if (!app_name || !user_id || !session_id) {
      return NextResponse.json(
        { success: false, error: 'app_name, user_id, and session_id are required' },
        { status: 400 }
      );
    }

    // Get session via ADK server
    const response = await fetch(
      `${ADK_SERVER_URL}/apps/${app_name}/users/${user_id}/sessions/${session_id}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);

    if (response.ok) {
      const session = await response.json();
      return NextResponse.json({
        success: true,
        data: session,
      });
    }

    if (response.status === 404) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    const errorText = await response.text();
    console.error(`[API] ADK server returned ${response.status} for session get:`, errorText);
    
    return NextResponse.json(
      { success: false, error: errorText || `Failed to get session (status: ${response.status})` },
      { status: response.status }
    );
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    let errorMessage = error.message || 'Unknown error';
    
    // Provide more specific error messages
    if (error.name === 'AbortError') {
      errorMessage = 'Request timeout - ADK server did not respond within 5 seconds';
    } else if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED') || error.cause?.code === 'ECONNREFUSED') {
      errorMessage = `Cannot connect to ADK server at ${ADK_SERVER_URL}. Make sure the ADK server is running. Start it with: adk api_server`;
    } else if (error.message?.includes('ENOTFOUND') || error.cause?.code === 'ENOTFOUND') {
      errorMessage = `Cannot resolve hostname for ${ADK_SERVER_URL}. Check your network connection and server URL.`;
    }
    
    console.error('[API] Error getting session:', errorMessage, error);
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

