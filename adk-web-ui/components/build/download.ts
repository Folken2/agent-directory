import { dataUrlToBytes } from '@/lib/build/data-url';
import { artifactDownloadUrl } from '@/lib/build/summary';
import type { Build } from '@/lib/build/types';

export type DownloadResult = 'ok' | 'gone' | 'error';

/**
 * Fetch the zip through the existing single-artifact route and save it.
 * A 404 means the backend restarted and its in-memory artifact is gone.
 */
export async function downloadBuildZip(
  appName: string,
  sessionId: string,
  build: Pick<Build, 'artifact' | 'version'>,
): Promise<DownloadResult> {
  try {
    const res = await fetch(artifactDownloadUrl(appName, sessionId, build));
    if (res.status === 404) return 'gone';
    const json = (await res.json().catch(() => null)) as { success?: boolean; data?: Array<{ url?: unknown }> } | null;
    const url = res.ok && json?.success ? json.data?.[0]?.url : undefined;
    const decoded = typeof url === 'string' ? dataUrlToBytes(url) : null;
    if (!decoded) return 'error';
    const href = URL.createObjectURL(new Blob([decoded.bytes], { type: decoded.mimeType }));
    const link = document.createElement('a');
    link.href = href;
    link.download = build.artifact;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 0);
    return 'ok';
  } catch {
    return 'error';
  }
}
