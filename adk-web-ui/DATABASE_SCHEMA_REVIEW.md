# Database Schema Review

## Overview
This document provides a comprehensive review of all database tables and their purposes.

---

## 🔐 Authentication Tables (Managed by Drizzle ORM)

### `users`
**Purpose:** User accounts for authentication  
**Schema:** OAuth-optimized (no password_hash)  
**Columns:**
- `id` (UUID) - Primary key
- `name` (VARCHAR) - User's display name
- `email` (VARCHAR, UNIQUE) - User's email address
- `email_verified` (TIMESTAMPTZ) - Email verification timestamp
- `image` (TEXT) - Profile image URL (from Google OAuth)
- `role` (ENUM: 'user' | 'admin') - User role
- `created_at` (TIMESTAMPTZ) - Account creation time
- `updated_at` (TIMESTAMPTZ) - Last update time

**Managed by:** Drizzle ORM migrations

### `accounts`
**Purpose:** NextAuth.js OAuth provider connections  
**Schema:** Stores Google OAuth account information  
**Columns:**
- `id` (UUID) - Primary key
- `user_id` (UUID) - Foreign key to users
- `provider` (VARCHAR) - OAuth provider name ('google')
- `provider_account_id` (VARCHAR) - Google account ID
- `access_token`, `refresh_token`, `id_token` (TEXT) - OAuth tokens
- `expires_at` (BIGINT) - Token expiration timestamp
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Managed by:** Drizzle ORM migrations

### `auth_sessions`
**Purpose:** NextAuth.js user sessions  
**Schema:** Stores active user sessions  
**Columns:**
- `id` (UUID) - Primary key
- `session_token` (VARCHAR, UNIQUE) - Session token
- `user_id` (UUID) - Foreign key to users
- `expires` (TIMESTAMPTZ) - Session expiration time
- `created_at` (TIMESTAMPTZ)

**Managed by:** Drizzle ORM migrations

### `verification_tokens`
**Purpose:** NextAuth.js email verification tokens  
**Schema:** Stores verification tokens for email verification  
**Columns:**
- `identifier` (VARCHAR) - Email or identifier
- `token` (VARCHAR, UNIQUE) - Verification token
- `expires` (TIMESTAMPTZ) - Token expiration time

**Managed by:** Drizzle ORM migrations

---

## 🤖 Agent Tracking Tables (Managed by Drizzle ORM)

### `agent_stats`
**Purpose:** Aggregated statistics per agent  
**Schema:** Summary stats (stars, runs, last run time)  
**Columns:**
- `agent_slug` (TEXT) - Primary key, agent identifier
- `stars_count` (INTEGER) - Total number of stars
- `runs` (INTEGER) - Total number of runs
- `last_run_at` (TIMESTAMPTZ) - Timestamp of last run

**Usage:** Displayed on agent cards, used for sorting/filtering  
**Managed by:** Drizzle ORM migrations (migrated from inline SQL)

### `agent_star_events`
**Purpose:** Individual star/unstar actions  
**Schema:** Event log for star tracking  
**Columns:**
- `id` (BIGSERIAL) - Primary key
- `agent_slug` (TEXT) - Agent identifier
- `session_id` (UUID) - Session that starred the agent
- `created_at` (TIMESTAMPTZ) - When the star was added

**Usage:** Tracks who starred what, prevents duplicate stars  
**Managed by:** Drizzle ORM migrations (migrated from inline SQL)

### `agent_run_events` ⭐ NEW
**Purpose:** Individual agent run tracking  
**Schema:** Event log for agent executions  
**Columns:**
- `id` (UUID) - Primary key
- `agent_slug` (TEXT) - Agent identifier
- `user_id` (TEXT) - ADK user ID (string format)
- `session_id` (TEXT) - ADK session ID (string format)
- `app_name` (TEXT) - App/agent name
- `status` (TEXT) - Run status: 'pending' | 'running' | 'completed' | 'error'
- `error_message` (TEXT) - Error message if status is 'error'
- `created_at` (TIMESTAMPTZ) - When run started
- `completed_at` (TIMESTAMPTZ) - When run completed (if completed)

**Usage:** 
- Track individual agent runs
- Analytics: which agents are most popular
- Debugging: see run history and errors
- User history: show user's recent agent runs

**Managed by:** Drizzle ORM migrations

---

## 💬 Community Tables (Still inline SQL - to be migrated)

### `posts`
**Purpose:** Community posts/discussions  
**Schema:** User-generated content  
**Columns:**
- `id` (UUID) - Primary key
- `title` (VARCHAR) - Post title
- `content` (TEXT) - Post content
- `author_id` (UUID) - User who created the post
- `author` (VARCHAR) - Author name (denormalized)
- `created_at` (TIMESTAMP) - Post creation time

**Status:** Still created inline, should be migrated to Drizzle

### `post_likes`
**Purpose:** Post likes  
**Schema:** Many-to-many relationship  
**Columns:**
- `id` (UUID) - Primary key
- `post_id` (UUID) - Foreign key to posts
- `user_id` (UUID) - User who liked the post
- `created_at` (TIMESTAMP) - Like timestamp

**Status:** Still created inline, should be migrated to Drizzle

### `post_comments`
**Purpose:** Post comments  
**Schema:** Comments on posts  
**Columns:**
- `id` (UUID) - Primary key
- `post_id` (UUID) - Foreign key to posts
- `user_id` (UUID) - User who commented
- `author` (VARCHAR) - Author name (denormalized)
- `content` (TEXT) - Comment content
- `created_at` (TIMESTAMP) - Comment timestamp

**Status:** Still created inline, should be migrated to Drizzle

---

## 🔧 ADK Python Server Tables (Auto-created by ADK)

### `sessions`
**Purpose:** ADK session management  
**Schema:** ADK server session storage  
**Columns:**
- `app_name` (VARCHAR) - Application name
- `user_id` (VARCHAR) - ADK user ID
- `id` (VARCHAR) - Session ID
- `state` (JSONB) - Session state
- `create_time` (TIMESTAMP) - Session creation
- `update_time` (TIMESTAMP) - Last update

**Managed by:** ADK Python server automatically

### `events`
**Purpose:** ADK event tracking  
**Schema:** Detailed event log for ADK sessions  
**Columns:**
- `id` (VARCHAR) - Event ID
- `app_name`, `user_id`, `session_id` (VARCHAR) - Session identifiers
- `invocation_id` (VARCHAR) - Invocation identifier
- `author` (VARCHAR) - Event author
- `actions` (BYTEA) - Serialized actions
- `content` (JSONB) - Event content
- `timestamp` (TIMESTAMP) - Event timestamp
- `usage_metadata`, `citation_metadata`, `grounding_metadata` (JSONB) - Metadata
- `error_code`, `error_message` (VARCHAR) - Error information
- `turn_complete`, `partial`, `interrupted` (BOOLEAN) - Status flags

**Managed by:** ADK Python server automatically

### `app_states`
**Purpose:** Application-level state  
**Schema:** Persistent state for app_name scope  
**Managed by:** ADK Python server automatically

### `user_states`
**Purpose:** User-level state  
**Schema:** Persistent state for user_id scope  
**Managed by:** ADK Python server automatically

---

## 📊 Summary

### Tables by Category

**Authentication (4 tables):**
- ✅ `users` - User accounts
- ✅ `accounts` - OAuth connections
- ✅ `auth_sessions` - Active sessions
- ✅ `verification_tokens` - Email verification

**Agent Tracking (3 tables):**
- ✅ `agent_stats` - Aggregated stats
- ✅ `agent_star_events` - Star tracking
- ✅ `agent_run_events` - Run tracking ⭐ NEW

**Community (3 tables):**
- ⚠️ `posts` - Community posts (inline SQL)
- ⚠️ `post_likes` - Post likes (inline SQL)
- ⚠️ `post_comments` - Post comments (inline SQL)

**ADK Server (4 tables):**
- 🔧 `sessions` - ADK sessions (auto-created)
- 🔧 `events` - ADK events (auto-created)
- 🔧 `app_states` - App state (auto-created)
- 🔧 `user_states` - User state (auto-created)

### Migration Status

✅ **Migrated to Drizzle ORM:**
- Authentication tables (users, accounts, auth_sessions, verification_tokens)
- Agent tracking tables (agent_stats, agent_star_events, agent_run_events)

⚠️ **Still inline SQL (should migrate):**
- Community tables (posts, post_likes, post_comments)

🔧 **Managed by ADK Server:**
- ADK server tables (sessions, events, app_states, user_states)

---

## 🎯 Agent Run Tracking Implementation

### How It Works

1. **When an agent is run** (`/api/run`):
   - Creates entry in `agent_run_events` with status 'running'
   - Updates `agent_stats.runs` counter
   - Updates `agent_stats.last_run_at`

2. **On completion:**
   - Updates `agent_run_events` status to 'completed' or 'error'
   - Sets `completed_at` timestamp
   - Stores error message if failed

3. **Querying:**
   - Use `getAgentRunCount(agentSlug)` to get total runs
   - Use `getRecentAgentRuns(agentSlug, limit)` for run history
   - Use `agent_stats` table for aggregated stats

### Benefits

- ✅ Track individual runs (who ran what, when)
- ✅ Track run success/failure rates
- ✅ Analytics: most popular agents, user activity
- ✅ Debugging: see run history and errors
- ✅ User history: show user's recent agent runs

---

## 🔄 Next Steps

1. ✅ Agent run tracking implemented
2. ⚠️ Consider migrating community tables to Drizzle ORM
3. ✅ All agent tracking now uses Drizzle ORM
4. ✅ Database schema is production-ready

