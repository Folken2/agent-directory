import { sql } from 'drizzle-orm';
import { db } from '@/lib/drizzle/db';
import { blueprintSubmissions } from '@/lib/drizzle/schema/blueprint-submissions';
import type { SubmissionRecord } from './submission';

let ensured: Promise<void> | null = null;

/** Idempotent bootstrap, once per process (same table as migration 0014). */
function ensureSchema(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "blueprint_submissions" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "email" text NOT NULL,
          "consent_at" timestamp with time zone NOT NULL,
          "user_id" text,
          "session_id" text,
          "blueprint_name" text NOT NULL,
          "blueprint" jsonb NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_blueprint_submissions_created_at"
        ON "blueprint_submissions" USING btree ("created_at")
      `);
    })().catch((error) => {
      ensured = null;
      throw error;
    });
  }
  return ensured;
}

export async function storeSubmission(record: SubmissionRecord): Promise<{ id: string }> {
  await ensureSchema();
  const [row] = await db
    .insert(blueprintSubmissions)
    .values({
      email: record.email,
      consentAt: record.consentAt,
      userId: record.userId,
      sessionId: record.sessionId,
      blueprintName: record.blueprint.name,
      blueprint: record.blueprint,
    })
    .returning({ id: blueprintSubmissions.id });
  return { id: row.id };
}
