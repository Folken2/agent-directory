import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';

// Agent run events table - tracks individual agent runs
// Note: user_id and session_id are text to match ADK server format (not UUID)
export const agentRunEvents = pgTable(
  'agent_run_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentSlug: text('agent_slug').notNull(),
    userId: text('user_id').notNull(), // ADK user_id format (string, not UUID)
    sessionId: text('session_id').notNull(), // ADK session_id format (string, not UUID)
    appName: text('app_name').notNull(),
    status: text('status').notNull(), // 'pending' | 'running' | 'completed' | 'error'
    errorMessage: text('error_message'),
    rateLimitIdentifier: text('rate_limit_identifier'), // UUID for authenticated users, session_token for anonymous users
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    agentSlugIdx: index('idx_agent_run_events_slug').on(table.agentSlug),
    userIdIdx: index('idx_agent_run_events_user_id').on(table.userId),
    sessionIdIdx: index('idx_agent_run_events_session_id').on(table.sessionId),
    createdAtIdx: index('idx_agent_run_events_created_at').on(table.createdAt),
    rateLimitIdx: index('idx_agent_run_events_rate_limit').on(table.rateLimitIdentifier, table.createdAt),
  })
);

