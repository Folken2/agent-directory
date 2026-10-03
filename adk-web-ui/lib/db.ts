import { neon } from '@neondatabase/serverless';
import './drizzle/neon-local';

// Re-export agent stats functions from Drizzle-based implementation
export {
  getAgentStatsMap,
  ensureAgentStatsRow,
  starAgent,
  unstarAgent,
} from './db-agent-stats';

const DATABASE_URL = process.env.DATABASE_URL;
const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

// Note: agent_stats and agent_star_events tables are now managed by Drizzle ORM migrations
// No need to create them inline anymore

export const isDbEnabled = () => Boolean(sql);
