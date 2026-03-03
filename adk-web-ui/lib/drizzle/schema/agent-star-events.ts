import { pgTable, bigserial, text, uuid, timestamp, index } from 'drizzle-orm/pg-core';

// Agent star events table - tracks individual star/unstar actions
export const agentStarEvents = pgTable(
  'agent_star_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    agentSlug: text('agent_slug').notNull(),
    sessionId: uuid('session_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    agentSlugSessionIdx: index('idx_agent_star_events_slug_session').on(
      table.agentSlug,
      table.sessionId
    ),
    agentSlugIdx: index('idx_agent_star_events_slug').on(table.agentSlug),
  })
);

