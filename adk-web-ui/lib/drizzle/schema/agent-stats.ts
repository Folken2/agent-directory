import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

// Agent statistics table - tracks aggregated stats per agent
export const agentStats = pgTable(
  'agent_stats',
  {
    agentSlug: text('agent_slug').primaryKey(),
    starsCount: integer('stars_count').default(0),
    runs: integer('runs').default(0),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  },
  (table) => ({
    agentSlugIdx: index('idx_agent_stats_slug').on(table.agentSlug),
  })
);

