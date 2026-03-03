import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';

// Anonymous sessions table - tracks non-authenticated users for rate limiting
// Session tokens are stored in HttpOnly cookies to prevent client-side manipulation
export const anonymousSessions = pgTable(
  'anonymous_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
    ipAddress: varchar('ip_address', { length: 45 }), // IPv6 max length
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastInteractionAt: timestamp('last_interaction_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionTokenIdx: index('idx_anonymous_sessions_token').on(table.sessionToken),
    createdAtIdx: index('idx_anonymous_sessions_created_at').on(table.createdAt),
  })
);

