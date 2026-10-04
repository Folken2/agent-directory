import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/drizzle/db';
import { buildSaves } from '@/lib/drizzle/schema/build-saves';
import type { NewBuildSave } from './types';

let ensured: Promise<void> | null = null;

/** Idempotent bootstrap, once per process (same table as migration 0015). */
function ensureSchema(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "build_saves" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "token_hash" text NOT NULL,
          "email" text,
          "user_id" text,
          "session_id" text NOT NULL,
          "project_name" text NOT NULL,
          "build" jsonb NOT NULL,
          "zip" bytea,
          "zip_bytes" integer NOT NULL,
          "updates_consent_at" timestamp with time zone,
          "help_requested" boolean DEFAULT false NOT NULL,
          "email_sent_at" timestamp with time zone,
          "notified" boolean DEFAULT false NOT NULL,
          "downloads" integer DEFAULT 0 NOT NULL,
          "last_downloaded_at" timestamp with time zone,
          "deleted_at" timestamp with time zone,
          CONSTRAINT "build_saves_token_hash_unique" UNIQUE("token_hash")
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_build_saves_created_at" ON "build_saves" USING btree ("created_at")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_build_saves_session_id" ON "build_saves" USING btree ("session_id")
      `);
    })().catch((error) => {
      ensured = null;
      throw error;
    });
  }
  return ensured;
}

export async function insertBuildSave(record: NewBuildSave): Promise<{ id: string }> {
  await ensureSchema();
  const [row] = await db
    .insert(buildSaves)
    .values({
      tokenHash: record.tokenHash,
      email: record.email,
      userId: record.userId,
      sessionId: record.sessionId,
      projectName: record.build.name,
      build: record.build,
      zip: record.zip,
      zipBytes: record.zip.length,
      updatesConsentAt: record.updatesConsentAt,
      helpRequested: record.helpRequested,
    })
    .returning({ id: buildSaves.id });
  return { id: row.id };
}

export async function markEmailSent(id: string): Promise<void> {
  await ensureSchema();
  await db.update(buildSaves).set({ emailSentAt: new Date() }).where(eq(buildSaves.id, id));
}

export async function markNotified(id: string): Promise<void> {
  await ensureSchema();
  await db.update(buildSaves).set({ notified: true }).where(eq(buildSaves.id, id));
}

export type BuildSaveView = {
  projectName: string;
  build: unknown;
  zipBytes: number;
  createdAt: Date;
  deletedAt: Date | null;
};

/** Metadata for the link page: never the zip, never the email. */
export async function findBuildSave(tokenHash: string): Promise<BuildSaveView | null> {
  await ensureSchema();
  const [row] = await db
    .select({
      projectName: buildSaves.projectName,
      build: buildSaves.build,
      zipBytes: buildSaves.zipBytes,
      createdAt: buildSaves.createdAt,
      deletedAt: buildSaves.deletedAt,
    })
    .from(buildSaves)
    .where(eq(buildSaves.tokenHash, tokenHash))
    .limit(1);
  return row ?? null;
}

/** The stored zip, counting the download; null when unknown or deleted. */
export async function takeBuildZip(tokenHash: string): Promise<{ zip: Buffer; projectName: string } | null> {
  await ensureSchema();
  const [row] = await db
    .update(buildSaves)
    .set({ downloads: sql`${buildSaves.downloads} + 1`, lastDownloadedAt: new Date() })
    .where(and(eq(buildSaves.tokenHash, tokenHash), isNull(buildSaves.deletedAt), isNotNull(buildSaves.zip)))
    .returning({ zip: buildSaves.zip, projectName: buildSaves.projectName });
  return row?.zip ? { zip: row.zip, projectName: row.projectName } : null;
}

/** "Delete this build": drop the zip and the email, keep the anonymous metadata. */
export async function wipeBuildSave(tokenHash: string): Promise<boolean> {
  await ensureSchema();
  const rows = await db
    .update(buildSaves)
    .set({ zip: null, email: null, deletedAt: new Date() })
    .where(and(eq(buildSaves.tokenHash, tokenHash), isNull(buildSaves.deletedAt)))
    .returning({ id: buildSaves.id });
  return rows.length > 0;
}

/** Hard-delete a row whose email could not be sent, so failed attempts leave no zip behind. */
export async function deleteBuildSave(id: string): Promise<void> {
  await ensureSchema();
  await db.delete(buildSaves).where(eq(buildSaves.id, id));
}

export const buildSaveStore = { insert: insertBuildSave, markEmailSent, markNotified, delete: deleteBuildSave };
export const buildLinkStore = { takeZip: takeBuildZip, wipe: wipeBuildSave };
