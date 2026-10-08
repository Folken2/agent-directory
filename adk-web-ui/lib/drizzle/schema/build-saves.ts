import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core';
import { bytea } from '../bytea';

/**
 * Builds a visitor emailed to themselves: the zip, the build summary and the
 * email, behind a link whose token is only stored hashed. "Delete this build"
 * nulls `email` and `zip` and sets `deleted_at`. Analytics reads the
 * metadata columns only, never `zip`. Personal data: see /privacy.
 */
export const buildSaves = pgTable(
  'build_saves',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    email: text('email'),
    userId: text('user_id'),
    sessionId: text('session_id').notNull(),
    projectName: text('project_name').notNull(),
    build: jsonb('build').notNull(),
    zip: bytea('zip'),
    zipBytes: integer('zip_bytes').notNull(),
    updatesConsentAt: timestamp('updates_consent_at', { withTimezone: true }),
    helpRequested: boolean('help_requested').default(false).notNull(),
    emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
    notified: boolean('notified').default(false).notNull(),
    downloads: integer('downloads').default(0).notNull(),
    lastDownloadedAt: timestamp('last_downloaded_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    createdAtIdx: index('idx_build_saves_created_at').on(table.createdAt),
    sessionIdIdx: index('idx_build_saves_session_id').on(table.sessionId),
  })
);

export type BuildSave = typeof buildSaves.$inferSelect;
