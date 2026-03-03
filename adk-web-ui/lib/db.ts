import { neon } from '@neondatabase/serverless';

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

// Get database connection for API routes
// Note: Users table and auth tables are now managed by Drizzle ORM migrations
// This function is kept for backward compatibility with existing code that uses it
export async function getDb() {
  if (!sql) throw new Error('Database is not configured');
  
  // Ensure community tables exist (posts, post_likes, post_comments)
  // These are still created inline for now, but should be migrated to Drizzle in the future
  await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      author_id UUID NOT NULL,
      author VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS post_likes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(post_id, user_id)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS post_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      author VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  // Create indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);`;

  return sql;
}
