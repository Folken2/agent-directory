import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Consent-gated active-use events (messages, tool calls, dwell heartbeats).
 * Only written when ad_consent=all.
 */
export const engagementEvents = pgTable(
  'engagement_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    visitorId: text('visitor_id').notNull(),
    userId: text('user_id'),
    agentSlug: text('agent_slug'),
    eventType: text('event_type').notNull(),
    path: text('path').notNull(),
    sessionKey: text('session_key'),
    durationMs: integer('duration_ms'),
    metadata: text('metadata'),
  },
  (table) => ({
    createdAtIdx: index('idx_engagement_created_at').on(table.createdAt),
    agentIdx: index('idx_engagement_agent').on(table.agentSlug),
    typeIdx: index('idx_engagement_type').on(table.eventType),
  })
);

export type EngagementEvent = typeof engagementEvents.$inferSelect;
export type NewEngagementEvent = typeof engagementEvents.$inferInsert;
