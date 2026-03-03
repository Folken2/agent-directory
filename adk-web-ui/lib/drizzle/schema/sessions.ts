import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

// NextAuth.js sessions table
// Renamed to 'auth_sessions' to avoid conflict with ADK backend sessions table
// Column names must match what @auth/drizzle-adapter expects
export const authSessions = pgTable(
  'auth_sessions',
  {
    sessionToken: varchar('session_token', { length: 255 }).notNull().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_auth_sessions_user_id').on(table.userId),
  })
);

// Export as 'sessions' for NextAuth.js adapter compatibility
// NextAuth expects a table named 'sessions' but we're using 'auth_sessions' in DB
export const sessions = authSessions;
