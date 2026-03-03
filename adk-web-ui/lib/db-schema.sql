-- Database schema reference (managed by Drizzle ORM migrations)
-- This file is for reference only - actual schema is in lib/drizzle/schema/

-- Users table (OAuth-optimized, no password_hash)
-- Managed by Drizzle: lib/drizzle/schema/users.ts
-- Columns: id, name, email, email_verified, image, role, created_at, updated_at

-- Accounts table (NextAuth.js OAuth accounts)
-- Managed by Drizzle: lib/drizzle/schema/accounts.ts
-- Stores OAuth provider connections (Google, etc.)

-- Auth Sessions table (NextAuth.js sessions)
-- Managed by Drizzle: lib/drizzle/schema/sessions.ts
-- Stores user session tokens

-- Verification Tokens table (NextAuth.js)
-- Managed by Drizzle: lib/drizzle/schema/verification-tokens.ts
-- For email verification if needed

-- Posts table (community features - still inline for now)
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL,
  author VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Post likes table
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Post comments table
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  author VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
