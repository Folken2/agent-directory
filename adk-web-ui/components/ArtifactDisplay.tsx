'use client';

import { useAppStore } from '@/lib/store';
import { Artifact } from '@/lib/types';
import Image from 'next/image';

function getFileIcon(mimeType: string) {
  if (mimeType?.includes('pdf')) {
    return (
      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
    );
  } else if (mimeType?.includes('document') || mimeType?.includes('word')) {
    return (
      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
    );
  } else if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) {
    return (
      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    );
  } else if (mimeType?.includes('text')) {
    return (
      <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
    );
  } else {
    return (
      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
}

export default function ArtifactDisplay() {
  const { artifacts } = useAppStore();

  console.log('[ArtifactDisplay] Current artifacts:', artifacts);

  if (artifacts.length === 0) {
    console.log('[ArtifactDisplay] No artifacts to display');
    return null;
  }

  const imageArtifacts = artifacts.filter((a) => a.type === 'image');
  const documentArtifacts = artifacts.filter((a) => ['pdf', 'document', 'spreadsheet', 'text', 'file'].includes(a.type));

  console.log('[ArtifactDisplay] Image artifacts:', imageArtifacts.length, 'Document artifacts:', documentArtifacts.length);

  return (
    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Generated Artifacts
      </h3>

      {imageArtifacts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {imageArtifacts.map((artifact) => {
            console.log('[ArtifactDisplay] Rendering image artifact:', artifact.name, 'URL starts with:', artifact.url.substring(0, 50));
            return (
              <div
                key={artifact.id}
                className="relative group bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
              >
                <div className="aspect-square relative">
                  {/* Use regular img tag for data URLs since Next.js Image has issues with large data URLs */}
                  <img
                    src={artifact.url}
                    alt={artifact.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error('[ArtifactDisplay] Image failed to load:', artifact.name, 'URL length:', artifact.url.length, e);
                    }}
                    onLoad={() => {
                      console.log('[ArtifactDisplay] Image loaded successfully:', artifact.name);
                    }}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity flex items-center justify-center">
                    <a
                      href={artifact.url}
                      download={artifact.name}
                      className="opacity-0 group-hover:opacity-100 px-4 py-2 bg-white text-gray-900 rounded-lg font-medium transition-opacity"
                    >
                      Download
                    </a>
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{artifact.name}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {documentArtifacts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">Documents & Files</h4>
          {documentArtifacts.map((artifact) => (
            <a
              key={artifact.id}
              href={artifact.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {getFileIcon(artifact.url.split(';')[0].split(':')[1])}
              <div className="ml-3 flex-1">
                <span className="text-sm text-gray-700 dark:text-gray-300 block">{artifact.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {artifact.url.split(';')[0].split(':')[1] || 'Unknown type'}
                </span>
              </div>
              <svg className="w-4 h-4 text-gray-400 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

