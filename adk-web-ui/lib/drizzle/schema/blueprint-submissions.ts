import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

/**
 * Builder blueprints a visitor chose to save, with the email they gave and
 * the time they consented to being contacted. Personal data: see /privacy.
 */
export const blueprintSubmissions = pgTable(
  'blueprint_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    email: text('email').notNull(),
    consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
    userId: text('user_id'),
    sessionId: text('session_id'),
    blueprintName: text('blueprint_name').notNull(),
    blueprint: jsonb('blueprint').notNull(),
  },
  (table) => ({
    createdAtIdx: index('idx_blueprint_submissions_created_at').on(table.createdAt),
  })
);

export type BlueprintSubmission = typeof blueprintSubmissions.$inferSelect;
export type NewBlueprintSubmission = typeof blueprintSubmissions.$inferInsert;
