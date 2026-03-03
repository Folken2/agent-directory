import { pgTable, uuid, varchar, text, integer, timestamp, index, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users';

// NextAuth.js accounts table (stores OAuth provider connections)
// Column names must match what @auth/drizzle-adapter expects
export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 255 }).notNull(),
    provider: varchar('provider', { length: 255 }).notNull(),
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: varchar('token_type', { length: 255 }),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => ({
    compositePk: primaryKey({ columns: [table.provider, table.providerAccountId] }),
    userIdIdx: index('idx_accounts_user_id').on(table.userId),
  })
);
