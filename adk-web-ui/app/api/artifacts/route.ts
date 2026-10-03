import { NextRequest, NextResponse } from 'next/server';
import { adkFetch } from '@/lib/adk-config';
import { isScopeError, resolveAdkScope } from '@/lib/adk-scope';
import { adkPath, assertArtifactName } from '@/lib/adk-url';
import { toStandardBase64 } from '@/lib/artifact-base64';
import { newRequestId } from '@/lib/api-error';
import { apiError } from '@/lib/api-response';
import { rejectCrossOrigin } from '@/lib/origin-guard';

export async function POST(request: NextRequest) {
  const requestId = newRequestId();

  const crossOrigin = rejectCrossOrigin(request, requestId);
  if (crossOrigin) return crossOrigin;

  const scope = await resolveAdkScope(request, requestId);
  if (isScopeError(scope)) return scope;
  const { appName, sessionId, adkUserId } = scope;
  const artifactsBase = adkPath('apps', appName, 'users', adkUserId, 'sessions', sessionId, 'artifacts');

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return apiError('invalid_input', requestId, { log: error });
  }

  let filename: string;
  try {
    filename = assertArtifactName(body?.filename);
  } catch (error) {
    return apiError('invalid_input', requestId, { log: error });
  }

  const { artifact } = body;
  if (!artifact) {
    return apiError('invalid_input', requestId, { log: 'artifact is required' });
  }

  try {
    // Prepare SaveArtifactRequest format matching FastAPI
    const saveRequest = {
      filename,
      artifact,
      custom_metadata: body.custom_metadata || {}
    };

    const response = await adkFetch(artifactsBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saveRequest),
      timeoutMs: 30_000,
    });

    if (response.ok) {
      // Only the version goes back: the upstream body also carries the
      // artifact service's storage URI (e.g. a server file path).
      const result = (await response.json()) as { version?: unknown };
      return NextResponse.json({
        success: true,
        data: { version: typeof result.version === 'number' ? result.version : null },
      });
    } else {
      const errorText = await response.text();
      return apiError(response.status === 404 ? 'not_found' : 'backend_unavailable', requestId, {
        log: { status: response.status, detail: errorText.slice(0, 500) },
      });
    }
  } catch (error) {
    return apiError('backend_unavailable', requestId, { log: error });
  }
}

export async function DELETE(request: NextRequest) {
  const requestId = newRequestId();

  const crossOrigin = rejectCrossOrigin(request, requestId);
  if (crossOrigin) return crossOrigin;

  const scope = await resolveAdkScope(request, requestId);
  if (isScopeError(scope)) return scope;
  const { appName, sessionId, adkUserId } = scope;
  const artifactsBase = adkPath('apps', appName, 'users', adkUserId, 'sessions', sessionId, 'artifacts');

  const searchParams = request.nextUrl.searchParams;
  let artifactName: string;
  try {
    artifactName = assertArtifactName(searchParams.get('artifact_name'));
  } catch (error) {
    return apiError('invalid_input', requestId, { log: error });
  }

  try {
    const response = await adkFetch(`${artifactsBase}/${encodeURIComponent(artifactName)}`, {
      method: 'DELETE',
      timeoutMs: 10_000,
    });

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'Artifact deleted successfully',
      });
    } else {
      const errorText = await response.text();
      return apiError(response.status === 404 ? 'not_found' : 'backend_unavailable', requestId, {
        log: { status: response.status, detail: errorText.slice(0, 500) },
      });
    }
  } catch (error) {
    return apiError('backend_unavailable', requestId, { log: error });
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

  // ADK sends URL-safe base64; data: URLs need the standard alphabet.
  base64Data = toStandardBase64(base64Data);

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
  const requestId = newRequestId();

  const scope = await resolveAdkScope(request, requestId);
  if (isScopeError(scope)) return scope;
  const { appName, sessionId, adkUserId } = scope;
  const artifactsBase = adkPath('apps', appName, 'users', adkUserId, 'sessions', sessionId, 'artifacts');

  const searchParams = request.nextUrl.searchParams;
  const artifactNameParam = searchParams.get('artifact_name');
  const version = searchParams.get('version');

  try {
    if (artifactNameParam) {
      // Get specific artifact
      let artifactName: string;
      try {
        artifactName = assertArtifactName(artifactNameParam);
      } catch (error) {
        return apiError('invalid_input', requestId, { log: error });
      }

      const artifactPath = `${artifactsBase}/${encodeURIComponent(artifactName)}${
        version && /^\d+$/.test(version) ? `?version=${version}` : ''
      }`;

      const response = await adkFetch(artifactPath, {
        method: 'GET',
        timeoutMs: 10_000,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return apiError(response.status === 404 ? 'not_found' : 'backend_unavailable', requestId, {
          log: { status: response.status, detail: errorText.slice(0, 500) },
        });
      }

      const part = await response.json();
      const inlineData = extractInlineData(part);

      if (!inlineData) {
        return apiError('invalid_input', requestId, { log: 'Artifact has no inline data' });
      }

      const processed = processArtifactData(artifactName, inlineData);
      if (!processed) {
        return apiError('internal', requestId, { log: 'Failed to process artifact data' });
      }

      return NextResponse.json({
        success: true,
        data: [processed],
      });
    } else {
      // List all artifacts
      const response = await adkFetch(artifactsBase, {
        method: 'GET',
        timeoutMs: 10_000,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return apiError(response.status === 404 ? 'not_found' : 'backend_unavailable', requestId, {
          log: { status: response.status, detail: errorText.slice(0, 500) },
        });
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
          assertArtifactName(name);
        } catch {
          console.warn(`[Artifacts API] Skipping invalid upstream artifact name`);
          continue;
        }
        try {
          const artifactResponse = await adkFetch(`${artifactsBase}/${encodeURIComponent(name)}`, {
            method: 'GET',
            timeoutMs: 5_000,
          });

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
        } catch (e) {
          console.error(`[Artifacts API] Error loading artifact ${name}:`, e);
        }
      }

      return NextResponse.json({
        success: true,
        data: artifacts,
      });
    }
  } catch (error) {
    return apiError('backend_unavailable', requestId, { log: error });
  }
}
