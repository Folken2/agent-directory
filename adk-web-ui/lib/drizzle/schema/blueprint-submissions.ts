import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

/**
 * LEGACY: blueprints visitors saved before builds replaced them. Nothing
 * writes or reads this table any more; the schema stays so drizzle-kit
 * doesn't generate a DROP and existing rows are kept. Personal data: see
 * /privacy.
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
