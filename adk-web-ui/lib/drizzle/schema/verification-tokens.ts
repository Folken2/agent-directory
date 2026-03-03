import { pgTable, varchar, timestamp, index } from 'drizzle-orm/pg-core';

// NextAuth.js verification tokens
export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: varchar('identifier', { length: 255 }).notNull(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (table) => ({
    primaryKey: index('verification_tokens_pkey').on(table.identifier, table.token),
  })
);

