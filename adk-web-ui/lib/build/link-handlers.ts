import { zipFileName } from './summary';
import { hashBuildToken, isBuildToken } from './token';

export type BuildLinkStore = {
  takeZip(tokenHash: string): Promise<{ zip: Buffer; projectName: string } | null>;
  wipe(tokenHash: string): Promise<boolean>;
};

export type ZipDownload = { status: 404 } | { status: 200; body: Buffer; fileName: string };

/** Unknown, malformed and deleted tokens are all the same 404. */
export async function handleZipDownload(token: unknown, store: BuildLinkStore): Promise<ZipDownload> {
  if (!isBuildToken(token)) return { status: 404 };
  const row = await store.takeZip(hashBuildToken(token));
  return row ? { status: 200, body: row.zip, fileName: zipFileName(row.projectName) } : { status: 404 };
}

/** "Delete this build": wipes the zip and the email. */
export async function handleBuildDelete(token: unknown, store: BuildLinkStore): Promise<{ status: 200 | 404 }> {
  if (!isBuildToken(token)) return { status: 404 };
  return { status: (await store.wipe(hashBuildToken(token))) ? 200 : 404 };
}
