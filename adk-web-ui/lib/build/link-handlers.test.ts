import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleBuildDelete, handleZipDownload, type BuildLinkStore } from './link-handlers.ts';
import { hashBuildToken, newBuildToken } from './token.ts';

type Row = { zip: Buffer | null; email: string | null; projectName: string; deletedAt: Date | null; downloads: number };

/** Same semantics as db-store's takeBuildZip / wipeBuildSave. */
function memoryStore() {
  const rows = new Map<string, Row>();
  let calls = 0;
  const store: BuildLinkStore = {
    async takeZip(hash) {
      calls++;
      const r = rows.get(hash);
      if (!r || r.deletedAt || !r.zip) return null;
      r.downloads++;
      return { zip: r.zip, projectName: r.projectName };
    },
    async wipe(hash) {
      calls++;
      const r = rows.get(hash);
      if (!r || r.deletedAt) return false;
      Object.assign(r, { zip: null, email: null, deletedAt: new Date() });
      return true;
    },
  };
  return { rows, store, calls: () => calls };
}

const ZIP = Buffer.from([0x50, 0x4b, 5, 6]);

function seeded() {
  const m = memoryStore();
  const { token, hash } = newBuildToken();
  m.rows.set(hash, { zip: ZIP, email: 'delivered@resend.dev', projectName: 'research-summarizer', deletedAt: null, downloads: 0 });
  return { ...m, token, hash };
}

describe('build link handlers', () => {
  it('404s an unknown token, and a malformed one without a lookup', async () => {
    const m = memoryStore();
    assert.deepEqual(await handleZipDownload(newBuildToken().token, m.store), { status: 404 });
    assert.deepEqual(await handleBuildDelete(newBuildToken().token, m.store), { status: 404 });
    const before = m.calls();
    assert.deepEqual(await handleZipDownload('../etc/passwd', m.store), { status: 404 });
    assert.deepEqual(await handleBuildDelete(undefined, m.store), { status: 404 });
    assert.equal(m.calls(), before);
  });

  it('downloads the stored zip under the project name and counts it', async () => {
    const s = seeded();
    const out = await handleZipDownload(s.token, s.store);
    assert.equal(out.status, 200);
    assert.ok(out.status === 200 && out.body.equals(ZIP));
    assert.equal(out.status === 200 ? out.fileName : null, 'research-summarizer.zip');
    assert.equal(s.rows.get(s.hash)?.downloads, 1);
    assert.equal(hashBuildToken(s.token), s.hash);
  });

  it('delete wipes the zip and email; downloads then 404', async () => {
    const s = seeded();
    assert.deepEqual(await handleBuildDelete(s.token, s.store), { status: 200 });
    const row = s.rows.get(s.hash);
    assert.equal(row?.zip, null);
    assert.equal(row?.email, null);
    assert.ok(row?.deletedAt);
    assert.deepEqual(await handleZipDownload(s.token, s.store), { status: 404 });
    assert.deepEqual(await handleBuildDelete(s.token, s.store), { status: 404 });
  });
});
