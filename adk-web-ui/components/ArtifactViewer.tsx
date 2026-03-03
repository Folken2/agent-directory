'use client';

import Image from 'next/image';

interface ArtifactViewerProps {
  artifact: { inlineData: { data: string; mimeType: string } };
  filename: string;
}

// Helper function to safely decode base64
function safeBase64DecodeToString(base64: string): string {
  try {
    // Clean the base64 string
    const cleaned = base64.replace(/\s/g, '').replace(/[^A-Za-z0-9+/=]/g, '');
    
    // Validate base64 format
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
      console.error('[ArtifactViewer] Invalid base64 format');
      return 'Error: Invalid base64 format';
    }
    
    // Decode
    return atob(cleaned);
  } catch (error) {
    console.error('[ArtifactViewer] Error decoding base64:', error);
    return 'Error decoding text content';
  }
}

export default function ArtifactViewer({ artifact, filename }: ArtifactViewerProps) {
  const { data, mimeType } = artifact.inlineData;
  
  // Clean and validate base64 data before creating data URL
  const cleanedData = typeof data === 'string' ? data.replace(/\s/g, '') : String(data);
  
  // Convert base64 data to URL
  const dataUrl = `data:${mimeType};base64,${cleanedData}`;

  if (mimeType?.startsWith('image/')) {
    return (
      <div className="mt-3 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <h3 className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {filename}
        </h3>
        <div className="relative w-full">
          <Image
            src={dataUrl}
            alt={filename}
            width={500}
            height={300}
            className="object-contain w-full h-auto"
            unoptimized
          />
        </div>
      </div>
    );
  }

  if (mimeType === 'application/pdf') {
    return (
      <div className="mt-3 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <h3 className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {filename}
        </h3>
        <iframe
          src={dataUrl}
          width="100%"
          height="600px"
          title={filename}
          className="border-0"
        />
      </div>
    );
  }

  if (mimeType?.startsWith('text/')) {
    // Decode base64 for text files using safe decoder
    const textContent = safeBase64DecodeToString(cleanedData);
    
    return (
      <div className="mt-3 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <h3 className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {filename}
        </h3>
        <pre className="p-4 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 overflow-auto max-h-96">
          {textContent}
        </pre>
      </div>
    );
  }

  // Default: download link for other types
  return (
    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        {filename}
      </h3>
      <a
        href={dataUrl}
        download={filename}
        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download {filename}
      </a>
    </div>
  );
}

