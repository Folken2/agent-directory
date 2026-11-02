import { pgTable, date, text, boolean, integer, primaryKey } from 'drizzle-orm/pg-core';

/**
 * Daily roll-ups of raw analytics, written by the retention job before raw
 * rows older than 90 days are deleted. A day lives either here or in the raw
 * tables, never both, so the two can be summed. No identifiers are kept:
 * not the hashed IP, visitor id, user id, city or user agent.
 * Unknown values are stored as '' so they can sit in the primary key.
 */
export const pageViewDaily = pgTable(
  'page_view_daily',
  {
    day: date('day').notNull(),
    path: text('path').notNull(),
    isBot: boolean('is_bot').notNull(),
    botName: text('bot_name').notNull().default(''),
    country: text('country').notNull().default(''),
    deviceType: text('device_type').notNull().default(''),
    refHost: text('ref_host').notNull().default(''),
    views: integer('views').notNull(),
  },
  (table) => ({
    pk: primaryKey({
      name: 'page_view_daily_pk',
      columns: [
        table.day,
        table.path,
        table.isBot,
        table.botName,
        table.country,
        table.deviceType,
        table.refHost,
      ],
    }),
  })
);

export const engagementDaily = pgTable(
  'engagement_daily',
  {
    day: date('day').notNull(),
    eventType: text('event_type').notNull(),
    agentSlug: text('agent_slug').notNull().default(''),
    path: text('path').notNull(),
    landingPath: text('landing_path').notNull().default(''),
    events: integer('events').notNull(),
    /** Distinct visits (visit key, else visitor id) behind those events. */
    visits: integer('visits').notNull(),
    /** Sum of heartbeat durations, for time-in-chat. */
    durationMs: integer('duration_ms').notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({
      name: 'engagement_daily_pk',
      columns: [table.day, table.eventType, table.agentSlug, table.path, table.landingPath],
    }),
  })
);

export type PageViewDaily = typeof pageViewDaily.$inferSelect;
export type EngagementDaily = typeof engagementDaily.$inferSelect;
