import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Raw pageview events for directory analytics.
 * Privacy: store hashed IP only (never raw). Country/region/city from Vercel geo.
 */
export const pageViews = pgTable(
  'page_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    path: text('path').notNull(),
    query: text('query'),
    referrer: text('referrer'),

    country: text('country'),
    region: text('region'),
    city: text('city'),

    hashedIp: text('hashed_ip'),
    visitorId: text('visitor_id').notNull(),
    userId: text('user_id'),

    userAgent: text('user_agent'),
    isBot: boolean('is_bot').default(false).notNull(),
    botName: text('bot_name'),
    botCategory: text('bot_category'),
    /** high | medium | low */
    botConfidence: text('bot_confidence'),
    /** comma-separated detection signals */
    botSignals: text('bot_signals'),

    browser: text('browser'),
    os: text('os'),
    deviceType: text('device_type'),
    language: text('language'),

    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    utmTerm: text('utm_term'),
    utmContent: text('utm_content'),

    /** 'server' | 'client' */
    source: text('source').notNull(),
  },
  (table) => ({
    createdAtIdx: index('idx_page_views_created_at').on(table.createdAt),
    countryIdx: index('idx_page_views_country').on(table.country),
    pathIdx: index('idx_page_views_path').on(table.path),
    visitorIdx: index('idx_page_views_visitor_id').on(table.visitorId),
    botIdx: index('idx_page_views_is_bot').on(table.isBot),
    userIdx: index('idx_page_views_user_id').on(table.userId),
    dedupeIdx: index('idx_page_views_dedupe').on(
      table.visitorId,
      table.path,
      table.createdAt
    ),
  })
);

export type PageView = typeof pageViews.$inferSelect;
export type NewPageView = typeof pageViews.$inferInsert;
