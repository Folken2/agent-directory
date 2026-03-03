import { NextRequest, NextResponse } from 'next/server';

const ADK_SERVER_URL = process.env.NEXT_PUBLIC_ADK_SERVER_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  // Create an AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for saving artifacts

  try {
    const searchParams = request.nextUrl.searchParams;
    const app_name = searchParams.get('app_name');
    const user_id = searchParams.get('user_id') || 'default-user';
    const session_id = searchParams.get('session_id');

    if (!app_name || !session_id) {
      return NextResponse.json(
        { success: false, error: 'app_name and session_id are required' },
        { status: 400 }
      );
    }

    // Get the request body
    const body = await request.json();
    const { filename, artifact } = body;

    if (!filename || !artifact) {
      return NextResponse.json(
        { success: false, error: 'filename and artifact are required' },
        { status: 400 }
      );
    }

    // Prepare SaveArtifactRequest format matching FastAPI
    const saveRequest = {
      filename,
      artifact,
      custom_metadata: body.custom_metadata || {}
    };

    // Use correct ADK endpoint: POST /apps/{app_name}/users/{user_id}/sessions/{session_id}/artifacts
    const response = await fetch(
      `${ADK_SERVER_URL}/apps/${app_name}/users/${user_id}/sessions/${session_id}/artifacts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(saveRequest),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      return NextResponse.json({
        success: true,
        data: result,
      });
    } else {
      const errorText = await response.text();
      console.error('[Artifacts API POST] Error response:', errorText);
      return NextResponse.json(
        { success: false, error: `Failed to save artifact: ${response.status}` },
        { status: response.status }
      );
    }
  } catch (error: any) {
    clearTimeout(timeoutId);

    const errorMessage = error.name === 'AbortError'
      ? 'Request timeout - ADK server did not respond'
      : error.message || 'Unknown error';

    console.error('[API POST] Error saving artifact:', errorMessage);

    return NextResponse.json({
      success: false,
      error: `Failed to save artifact: ${errorMessage}`,
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  // Create an AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for deleting artifacts

  try {
    const searchParams = request.nextUrl.searchParams;
    const app_name = searchParams.get('app_name');
    const user_id = searchParams.get('user_id') || 'default-user';
    const session_id = searchParams.get('session_id');
    const artifact_name = searchParams.get('artifact_name');

    if (!app_name || !session_id || !artifact_name) {
      return NextResponse.json(
        { success: false, error: 'app_name, session_id, and artifact_name are required' },
        { status: 400 }
      );
    }

    // Use correct ADK endpoint: DELETE /apps/{app_name}/users/{user_id}/sessions/{session_id}/artifacts/{artifact_name}
    const response = await fetch(
      `${ADK_SERVER_URL}/apps/${app_name}/users/${user_id}/sessions/${session_id}/artifacts/${artifact_name}`,
      {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'Artifact deleted successfully',
      });
    } else {
      const errorText = await response.text();
      console.error('[Artifacts API DELETE] Error response:', errorText);
      return NextResponse.json(
        { success: false, error: `Failed to delete artifact: ${response.status}` },
        { status: response.status }
      );
    }
  } catch (error: any) {
    clearTimeout(timeoutId);

    const errorMessage = error.name === 'AbortError'
      ? 'Request timeout - ADK server did not respond'
      : error.message || 'Unknown error';

    console.error('[API DELETE] Error deleting artifact:', errorMessage);

    return NextResponse.json({
      success: false,
      error: `Failed to delete artifact: ${errorMessage}`,
    }, { status: 500 });
  }
}

// Helper function to determine artifact type from MIME type
function getArtifactType(mimeType: string): 'image' | 'pdf' | 'document' | 'spreadsheet' | 'text' | 'file' {
  if (mimeType.startsWith('image/')) {
    return 'image';
  } else if (mimeType.includes('pdf')) {
    return 'pdf';
  } else if (mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('msword')) {
    return 'document';
  } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('sheet')) {
    return 'spreadsheet';
  } else if (mimeType.startsWith('text/')) {
    return 'text';
  }
  return 'file';
}

// Helper function to extract inline data from artifact part
function extractInlineData(part: any): { data: string; mimeType: string } | null {
  // Handle camelCase format (preferred)
  if (part.inlineData) {
    const data = part.inlineData.data || '';
    const mimeType = part.inlineData.mimeType || 'application/octet-stream';
    if (data) {
      return { data: String(data), mimeType };
    }
  }
  
  // Handle snake_case format (fallback)
  if (part.inline_data) {
    const data = part.inline_data.data || '';
    const mimeType = part.inline_data.mime_type || part.inline_data.mimeType || 'application/octet-stream';
    if (data) {
      return { data: String(data), mimeType };
    }
  }
  
  return null;
}

// Helper function to process artifact data
function processArtifactData(name: string, inlineData: { data: string | any; mimeType: string }): any {
  let base64Data: string = '';
  
  // Ensure data is a string
  if (typeof inlineData.data === 'string') {
    base64Data = inlineData.data;
  } else if (inlineData.data && typeof inlineData.data === 'object') {
    // Try to convert if it's a buffer-like object
    const dataObj = inlineData.data as any;
    if ('data' in dataObj && dataObj.data) {
      const buffer = dataObj.data;
      if (buffer instanceof Uint8Array) {
        base64Data = Buffer.from(buffer).toString('base64');
      } else if (buffer instanceof ArrayBuffer) {
        base64Data = Buffer.from(new Uint8Array(buffer)).toString('base64');
      } else {
        console.error(`[Artifacts API] Cannot convert nested data for ${name}`);
        return null;
      }
    } else if (dataObj instanceof Uint8Array) {
      base64Data = Buffer.from(dataObj).toString('base64');
    } else if (dataObj instanceof ArrayBuffer) {
      base64Data = Buffer.from(new Uint8Array(dataObj)).toString('base64');
    } else {
      console.error(`[Artifacts API] Unknown data format for ${name}`);
      return null;
    }
  } else {
    console.error(`[Artifacts API] Cannot process data for ${name}, type: ${typeof inlineData.data}`);
    return null;
  }
  
  // Remove whitespace from base64 data
  base64Data = base64Data.replace(/\s/g, '');
  
  // Validate base64 format (basic check)
  if (base64Data && !/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
    console.warn(`[Artifacts API] Invalid base64 data for ${name}, data length: ${base64Data.length}`);
  }
  
  const type = getArtifactType(inlineData.mimeType);
  
  return {
    id: name,
    name: name,
    type,
    url: `data:${inlineData.mimeType};base64,${base64Data}`,
  };
}

export async function GET(request: NextRequest) {
  // Create an AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for artifacts
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const app_name = searchParams.get('app_name');
    const user_id = searchParams.get('user_id') || 'default-user';
    const session_id = searchParams.get('session_id');
    const artifact_name = searchParams.get('artifact_name');
    const version = searchParams.get('version');

    if (!app_name || !session_id) {
      return NextResponse.json(
        { success: false, error: 'app_name and session_id are required' },
        { status: 400 }
      );
    }

    if (artifact_name) {
      // Get specific artifact
      let artifactUrl = `${ADK_SERVER_URL}/apps/${app_name}/users/${user_id}/sessions/${session_id}/artifacts/${artifact_name}`;
      if (version) {
        artifactUrl += `/versions/${version}`;
      }
      
      const response = await fetch(artifactUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          return NextResponse.json({
            success: false,
            error: 'Artifact not found',
          }, { status: 404 });
        }
        const errorText = await response.text();
        console.error('[Artifacts API GET] Error response:', errorText);
        return NextResponse.json({
          success: false,
          error: `Failed to fetch artifact: ${response.status}`,
        }, { status: response.status });
      }

      const part = await response.json();
      const inlineData = extractInlineData(part);
      
      if (!inlineData) {
        console.warn('[Artifacts API] Artifact has no inlineData or inline_data');
        return NextResponse.json({
          success: false,
          error: 'Artifact has no inline data',
        }, { status: 400 });
      }

      const processed = processArtifactData(artifact_name, inlineData);
      if (!processed) {
        return NextResponse.json({
          success: false,
          error: 'Failed to process artifact data',
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: [processed],
      });
    } else {
      // List all artifacts
      const response = await fetch(
        `${ADK_SERVER_URL}/apps/${app_name}/users/${user_id}/sessions/${session_id}/artifacts`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal,
        }
      );
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Artifacts API GET] Error listing artifacts:', errorText);
        return NextResponse.json({
          success: false,
          error: `Failed to list artifacts: ${response.status}`,
        }, { status: response.status });
      }

      const artifactNames = await response.json();
      
      if (!Array.isArray(artifactNames)) {
        console.warn('[Artifacts API] Expected array of artifact names, got:', typeof artifactNames);
        return NextResponse.json({
          success: true,
          data: [],
        });
      }
      
      // Fetch each artifact
      const artifacts: any[] = [];
      for (const name of artifactNames) {
        try {
          const artifactController = new AbortController();
          const artifactTimeout = setTimeout(() => artifactController.abort(), 5000);
          
          const artifactResponse = await fetch(
            `${ADK_SERVER_URL}/apps/${app_name}/users/${user_id}/sessions/${session_id}/artifacts/${name}`,
            {
              headers: {
                'Accept': 'application/json',
              },
              signal: artifactController.signal,
            }
          );
          
          clearTimeout(artifactTimeout);
          
          if (artifactResponse.ok) {
            const part = await artifactResponse.json();
            const inlineData = extractInlineData(part);
            
            if (inlineData) {
              const processed = processArtifactData(name, inlineData);
              if (processed) {
                artifacts.push(processed);
              }
            } else {
              console.warn(`[Artifacts API] Artifact ${name} has no inlineData or inline_data`);
            }
          } else {
            console.warn(`[Artifacts API] Failed to fetch artifact ${name}: ${artifactResponse.status}`);
          }
        } catch (e: any) {
          console.error(`[Artifacts API] Error loading artifact ${name}:`, e.message);
        }
      }
      
      return NextResponse.json({
        success: true,
        data: artifacts,
      });
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    const errorMessage = error.name === 'AbortError' 
      ? 'Request timeout - ADK server did not respond'
      : error.message || 'Unknown error';
    
    console.error('[Artifacts API] Error fetching artifacts:', errorMessage);
    
    // Return empty array instead of error for artifacts (non-critical)
    return NextResponse.json({
      success: true,
      data: [],
      warning: `Failed to fetch artifacts: ${errorMessage}`,
    });
  }
}
