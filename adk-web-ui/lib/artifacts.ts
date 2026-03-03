// Artifact management utilities for ADK Web UI

export interface ArtifactPart {
  inlineData?: {
    data: string;
    mimeType: string;
  };
  inline_data?: {
    data: string;
    mime_type: string;
  };
}

export interface ArtifactResponse {
  inlineData?: {
    data: string;
    mimeType: string;
  };
  inline_data?: {
    data: string;
    mime_type: string;
  };
}

/**
 * List all artifacts for a session
 */
export async function listArtifacts(
  appName: string,
  userId: string,
  sessionId: string
): Promise<string[]> {
  const response = await fetch(
    `/api/artifacts?app_name=${appName}&user_id=${userId}&session_id=${sessionId}`
  );
  
  if (!response.ok) {
    throw new Error(`Failed to list artifacts: ${response.status}`);
  }
  
  const result = await response.json();
  if (result.success && Array.isArray(result.data)) {
    // If result.data is an array of artifact objects, extract names
    if (result.data.length > 0 && typeof result.data[0] === 'object') {
      return result.data.map((a: any) => a.name || a.id);
    }
    // If result.data is an array of strings (artifact names)
    return result.data;
  }
  
  return [];
}

/**
 * Load a specific artifact
 */
export async function loadArtifact(
  appName: string,
  userId: string,
  sessionId: string,
  artifactName: string,
  version?: number
): Promise<ArtifactResponse> {
  let url = `/api/artifacts?app_name=${appName}&user_id=${userId}&session_id=${sessionId}&artifact_name=${artifactName}`;
  if (version !== undefined) {
    url += `&version=${version}`;
  }
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to load artifact: ${response.status}`);
  }
  
  const result = await response.json();
  if (result.success && result.data && result.data.length > 0) {
    // Extract the artifact part from the response
    const artifact = result.data[0];
    // The API route should return the artifact in the correct format
    return artifact;
  }
  
  throw new Error('Artifact not found in response');
}

/**
 * Extract inline data from an artifact part (handles both camelCase and snake_case)
 */
export function extractInlineData(part: ArtifactPart): { data: string; mimeType: string } | null {
  if (part.inlineData) {
    return {
      data: part.inlineData.data || '',
      mimeType: part.inlineData.mimeType || 'application/octet-stream',
    };
  }
  
  if (part.inline_data) {
    return {
      data: part.inline_data.data || '',
      mimeType: part.inline_data.mime_type || 'application/octet-stream',
    };
  }
  
  return null;
}

/**
 * Create a data URL from inline data
 */
export function createDataUrl(data: string, mimeType: string): string {
  // Remove any whitespace from base64 data
  const cleanData = data.replace(/\s/g, '');
  return `data:${mimeType};base64,${cleanData}`;
}

