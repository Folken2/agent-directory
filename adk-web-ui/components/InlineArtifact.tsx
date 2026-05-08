'use client';

import { useState, useEffect, useRef } from 'react';
import { Artifact } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { toSessionId } from '@/lib/ids';
import { Download, Trash2, Save, FileText, ExternalLink, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineArtifactProps {
  artifact: Artifact;
}

// Helper function to safely decode base64
function safeBase64Decode(base64: string): Uint8Array | null {
  try {
    // Clean the base64 string - remove whitespace and invalid characters
    let cleaned = base64
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .replace(/\s/g, '')
      .replace(/[^A-Za-z0-9+/=]/g, '');

    if (!cleaned || cleaned.length === 0) {
      console.error('[InlineArtifact] Base64 string is empty after cleaning');
      return null;
    }

    // Validate base64 format (must be multiple of 4, or have proper padding)
    const paddingLength = (cleaned.match(/=/g) || []).length;
    if (paddingLength > 2) {
      console.error('[InlineArtifact] Invalid base64 padding');
      return null;
    }

    // Add padding if needed (base64 strings should be multiple of 4)
    // Remove existing padding first, then add correct amount
    cleaned = cleaned.replace(/=+$/, '');
    const remainder = cleaned.length % 4;
    if (remainder > 0) {
      // Add padding to make length a multiple of 4
      cleaned += '='.repeat(4 - remainder);
    }

    // Validate the cleaned base64 content before attempting to decode
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) {
      console.error('[InlineArtifact] Invalid base64 characters detected');
      return null;
    }

    // Decode
    const byteCharacters = atob(cleaned);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    console.log('[InlineArtifact] Successfully decoded base64:', {
      originalLength: base64.length,
      cleanedLength: cleaned.length,
      decodedLength: byteNumbers.length
    });

    return new Uint8Array(byteNumbers);
  } catch (error: any) {
    console.error('[InlineArtifact] Error decoding base64:', error.message || error, {
      base64Length: base64.length,
      errorName: error.name
    });
    return null;
  }
}

export default function InlineArtifact({ artifact }: InlineArtifactProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isImageLoading, setIsImageLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const previousArtifactUrlRef = useRef<string | null>(null);
  const blobUrlArtifactUrlRef = useRef<string | null>(null); // Track which artifact URL the blob URL corresponds to
  const blobUrlKeyRef = useRef<number>(0); // Key counter to force React to recreate img element

  const { selectedAgent, currentConversation } = useAppStore();

  const handleSaveArtifact = async () => {
    if (!selectedAgent || !currentConversation) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const sessionId = toSessionId(currentConversation.id);

      // Convert URL to base64 for saving
      let base64Data = '';
      let mimeType = 'application/octet-stream';

      if (artifact.url.startsWith('data:')) {
        // Handle data URLs - extract both MIME type and base64 data
        const dataUrlMatch = artifact.url.match(/^data:([^;]+);base64,(.+)$/);
        if (dataUrlMatch) {
          mimeType = dataUrlMatch[1] || 'application/octet-stream';
          base64Data = dataUrlMatch[2];
        } else {
          throw new Error('Invalid data URL format');
        }
      } else if (artifact.url.startsWith('blob:')) {
        // Handle blob URLs - need to fetch and convert to base64
        try {
          const response = await fetch(artifact.url);
          const blob = await response.blob();
          mimeType = blob.type || 'application/octet-stream';
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          base64Data = btoa(String.fromCharCode(...uint8Array));
        } catch (error) {
          console.error('[InlineArtifact] Error converting blob URL to base64:', error);
          throw new Error('Failed to convert blob URL to base64');
        }
      } else {
        throw new Error('Artifact URL must be a data URL or blob URL');
      }

      if (!base64Data) {
        throw new Error('No base64 data extracted from artifact URL');
      }

      // Remove artifact_name from query params - it's not needed for POST
      const response = await fetch(
        `/api/artifacts?app_name=${encodeURIComponent(selectedAgent.name)}&user_id=default-user&session_id=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: artifact.name,
            artifact: {
              inline_data: {
                mime_type: mimeType,
                data: base64Data,
              }
            },
            custom_metadata: {}
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to save artifact: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.detail || errorMessage;
        } catch {
          // If error text is not JSON, use it as-is if it's not empty
          if (errorText) {
            errorMessage = errorText;
          }
        }
        console.error('[InlineArtifact] Save failed:', response.status, errorMessage);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (result.success) {
        console.log('[InlineArtifact] Artifact saved successfully:', result.data);
      } else {
        throw new Error(result.error || 'Failed to save artifact');
      }
    } catch (error: any) {
      console.error('[InlineArtifact] Error saving artifact:', error);
      setSaveError(error.message || 'Failed to save artifact');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteArtifact = async () => {
    if (!selectedAgent || !currentConversation) return;

    const confirmed = window.confirm(`Are you sure you want to delete the artifact "${artifact.name}"?`);
    if (!confirmed) return;

    setIsDeleting(true);

    try {
      const sessionId = toSessionId(currentConversation.id);

      const response = await fetch(
        `/api/artifacts?app_name=${selectedAgent.name}&user_id=default-user&session_id=${sessionId}&artifact_name=${artifact.name}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete artifact: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        console.log('[InlineArtifact] Artifact deleted successfully');
        // Refresh artifacts in the store
        window.location.reload(); // Simple way to refresh - could be improved with proper state management
      } else {
        throw new Error(result.error || 'Failed to delete artifact');
      }
    } catch (error: any) {
      console.error('[InlineArtifact] Error deleting artifact:', error);
      setSaveError(error.message || 'Failed to delete artifact');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    console.log('[InlineArtifact] useEffect triggered for:', artifact.name, 'type:', artifact.type, 'has URL:', !!artifact.url);
    if (artifact.type === 'image') {
      setIsImageLoading(true);
    }

    // Only clean up previous blob URL if the artifact URL has actually changed
    // This prevents premature cleanup in React Strict Mode when the effect runs twice with the same URL
    const artifactUrlChanged = previousArtifactUrlRef.current !== artifact.url;

    if (artifactUrlChanged && blobUrlRef.current) {
      console.log('[InlineArtifact] Artifact URL changed, cleaning up previous blob URL for:', artifact.name);
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    // Update the previous artifact URL ref
    previousArtifactUrlRef.current = artifact.url;

    if (artifact.type === 'image' && artifact.url) {
      // If it's already a blob URL, use it directly
      // Note: We don't track blob URLs that come from external sources (like the store)
      // Only track blob URLs that we create ourselves in this component
      if (artifact.url.startsWith('blob:')) {
        console.log('[InlineArtifact] Using existing blob URL');
        setImageSrc(artifact.url);
        // Don't track external blob URLs - they're managed elsewhere
        // The cleanup function will handle any blob URLs we created
        return;
      }

      // If it's a data URL, try to convert to blob URL, but fallback to data URL if it fails
      if (artifact.url.startsWith('data:')) {
        try {
          // More robust regex that handles the full data URL (without 's' flag for compatibility)
          const dataUrlMatch = artifact.url.match(/^data:([^;]+);base64,([\s\S]*)$/);
          if (dataUrlMatch && dataUrlMatch[2]) {
            const mimeType = dataUrlMatch[1];
            const base64Data = dataUrlMatch[2];

            // Validate base64 data
            if (!base64Data || base64Data.length === 0) {
              console.error('[InlineArtifact] Empty base64 data for artifact:', artifact.name);
              setImageSrc(artifact.url); // Use original URL as fallback
              return;
            }

            console.log('[InlineArtifact] Processing artifact:', artifact.name, 'MIME type:', mimeType, 'Base64 length:', base64Data.length, 'Data URL length:', artifact.url.length);

            // Always convert data URLs to blob URLs for images to avoid browser limits
            // Browsers have varying limits on data URL length (typically 2MB, but can be less)
            // Converting to blob URLs is more reliable for all sizes
            console.log('[InlineArtifact] Converting data URL to blob URL for:', artifact.name);

            // Use safe base64 decoder
            const byteArray = safeBase64Decode(base64Data);

            if (byteArray && byteArray.length > 0) {
              try {
                // Create a new ArrayBuffer to ensure compatibility
                const buffer = new ArrayBuffer(byteArray.length);
                const view = new Uint8Array(buffer);
                view.set(byteArray);
                const blob = new Blob([buffer], { type: mimeType });
                const blobUrl = URL.createObjectURL(blob);

                // Only update if this blob URL is for the current artifact URL
                // This prevents race conditions in React Strict Mode
                if (previousArtifactUrlRef.current === artifact.url) {
                  // Revoke previous blob URL if it exists (from previous render or React Strict Mode)
                  if (blobUrlRef.current) {
                    console.log('[InlineArtifact] Revoking previous blob URL before creating new one');
                    URL.revokeObjectURL(blobUrlRef.current);
                  }

                  blobUrlRef.current = blobUrl; // Store in ref
                  blobUrlArtifactUrlRef.current = artifact.url; // Track which artifact URL this blob URL is for
                  blobUrlKeyRef.current += 1; // Increment key to force React to recreate img element
                  console.log('[InlineArtifact] Successfully created blob URL for:', artifact.name, 'Blob size:', blob.size, 'bytes', 'Key:', blobUrlKeyRef.current);
                  setImageSrc(blobUrl);
                } else {
                  // Artifact URL changed while we were processing, clean up this blob URL
                  console.log('[InlineArtifact] Artifact URL changed during processing, cleaning up blob URL');
                  URL.revokeObjectURL(blobUrl);
                }
              } catch (blobError) {
                console.error('[InlineArtifact] Error creating blob:', blobError);
                // Fallback to data URL (may not work for large images, but worth trying)
                console.warn('[InlineArtifact] Falling back to data URL for:', artifact.name, '(may fail for large images)');
                setImageSrc(artifact.url);
              }
            } else {
              // If decoding fails, fallback to using data URL directly
              console.warn('[InlineArtifact] Failed to decode base64 (byteArray is null or empty), using data URL directly for:', artifact.name);
              setImageSrc(artifact.url);
            }
          } else {
            // Not a valid data URL format, use as-is
            console.warn('[InlineArtifact] Invalid data URL format for artifact:', artifact.name, 'URL starts with:', artifact.url.substring(0, 50));
            setImageSrc(artifact.url);
          }
        } catch (error) {
          console.error('[InlineArtifact] Error converting data URL to blob:', error, 'URL length:', artifact.url.length);
          // Fallback to original URL
          setImageSrc(artifact.url);
        }
      } else {
        // Not a data URL or blob URL, use as-is (could be http/https)
        console.log('[InlineArtifact] Using non-data/blob URL:', artifact.url.substring(0, 50));
        setImageSrc(artifact.url);
      }
    } else if (artifact.type === 'image' && !artifact.url) {
      // Empty URL - don't set imageSrc to avoid React warning
      console.warn('[InlineArtifact] Image artifact has no URL:', artifact.name);
      setImageSrc('');
    }

    // Clean up blob URL when component unmounts or URL changes
    // This cleanup function runs when:
    // 1. Component unmounts
    // 2. Dependencies change (artifact.url, artifact.type, artifact.name)
    // In React Strict Mode, effects run twice, so cleanup runs between the two runs
    // We only revoke if the artifact URL has actually changed (not just React Strict Mode double-invocation)
    return () => {
      if (blobUrlRef.current) {
        // Only revoke if the artifact URL has changed from what the blob URL corresponds to
        // This prevents premature cleanup in React Strict Mode
        const artifactUrlChanged = blobUrlArtifactUrlRef.current !== artifact.url;
        if (artifactUrlChanged) {
          console.log('[InlineArtifact] Cleaning up blob URL (artifact URL changed):', artifact.name);
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
          blobUrlArtifactUrlRef.current = null;
        } else {
          // In React Strict Mode, the cleanup runs between the two effect runs
          // We don't revoke here because the second run will create a new blob URL
          // and the img element will be recreated with the new key, so it will use the new blob URL
          console.log('[InlineArtifact] Skipping cleanup (React Strict Mode double-invocation):', artifact.name);
        }
      }
    };
  }, [artifact.url, artifact.type, artifact.name]);

  if (artifact.type === 'image') {
    return (
      <div className="mt-3 rounded-xl overflow-hidden border border-border bg-card shadow-sm">
        {imageSrc ? (
          <div className="relative">
            {isImageLoading && (
              <div className="absolute inset-0 animate-pulse bg-muted/70" />
            )}
            <img
              key={blobUrlKeyRef.current}
              src={imageSrc}
              alt={artifact.name}
              className="w-full h-auto max-w-full relative"
              style={{ display: 'block' }}
              onLoad={() => setIsImageLoading(false)}
              onError={(e) => {
                console.error('[InlineArtifact] Image failed to load:', artifact.name);
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                setIsImageLoading(false);
                const errorDiv = document.createElement('div');
                errorDiv.className = 'p-4 bg-destructive/10 text-destructive text-sm flex items-center gap-2';
                errorDiv.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Failed to load image';
                target.parentElement?.appendChild(errorDiv);
              }}
            />
            {imageSrc && (
              <div className="absolute bottom-3 right-3 flex gap-2">
                <a
                  href={imageSrc}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2 py-1 text-xs rounded-md bg-background/80 border border-border shadow-sm hover:bg-background transition-colors"
                  title="Open"
                >
                  Open
                </a>
                <a
                  href={imageSrc}
                  download={artifact.name}
                  className="px-2 py-1 text-xs rounded-md bg-background/80 border border-border shadow-sm hover:bg-background transition-colors"
                  title="Download"
                >
                  Download
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-muted/50 text-muted-foreground text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Image URL is empty or invalid
          </div>
        )}
        <div className="px-4 py-3 bg-muted/30 border-t border-border flex items-center gap-2 overflow-hidden">
          <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-foreground truncate">{artifact.name}</span>
        </div>
        {saveError && (
          <div className="px-4 pb-3 text-xs text-destructive font-medium">
            {saveError}
          </div>
        )}
      </div>
    );
  }

  // For non-image artifacts, show a file link with controls
  return (
    <div className="mt-3 p-3 bg-card rounded-xl border border-border shadow-sm group hover:border-primary/20 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <a
          href={artifact.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 text-sm font-medium text-foreground hover:text-primary transition-colors flex-1 min-w-0"
        >
          <div className="p-2 bg-muted rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
            <FileText className="w-4 h-4" />
          </div>
          <span className="truncate">{artifact.name}</span>
          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
        </a>
        <div className="flex items-center gap-1">
          <button
            onClick={handleSaveArtifact}
            disabled={isSaving}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50"
            title="Save artifact to session"
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            onClick={handleDeleteArtifact}
            disabled={isDeleting}
            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50"
            title="Delete artifact from session"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {saveError && (
        <div className="mt-2 text-xs text-destructive font-medium">
          {saveError}
        </div>
      )}
    </div>
  );
}

