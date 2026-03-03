/**
 * Script to fix sessions table conflict between NextAuth and ADK
 * Run with: node scripts/fix-sessions-table.mjs
 */

import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
config({ path: resolve(__dirname, '../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(DATABASE_URL);

async function fixSessionsTable() {
  console.log('🔍 Checking current database state...\n');

  try {
    // Check current state
    const checkResult = await sql`
      SELECT 
        table_name,
        column_name,
        data_type
      FROM 
        information_schema.columns
      WHERE 
        table_name IN ('sessions', 'auth_sessions', 'adk_sessions')
      ORDER BY 
        table_name, ordinal_position;
    `;

    console.log('Current tables:');
    if (checkResult.length > 0) {
      console.table(checkResult);
    } else {
      console.log('No sessions tables found yet.\n');
    }

    console.log('\n🔧 Running migration...\n');

    // Check if adk_sessions exists (should be renamed to sessions)
    const hasAdkSessions = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'adk_sessions'
      );
    `;

    // Check if sessions exists and what structure it has
    const hasSessionsTable = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'sessions'
      );
    `;

    if (hasSessionsTable[0]?.exists) {
      // Check if it's NextAuth structure (has session_token)
      const hasSessionToken = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'sessions' AND column_name = 'session_token'
        );
      `;

      if (hasSessionToken[0]?.exists) {
        // Drop the NextAuth sessions table (auth_sessions already exists)
        await sql`DROP TABLE IF EXISTS sessions CASCADE;`;
        console.log('✅ Dropped NextAuth sessions table (auth_sessions already exists)');
      }
    }

    // Rename adk_sessions to sessions if it exists
    if (hasAdkSessions[0]?.exists) {
      await sql`ALTER TABLE adk_sessions RENAME TO sessions;`;
      console.log('✅ Renamed adk_sessions → sessions');
    } else {
      // Create ADK sessions table if it doesn't exist
      await sql`
        CREATE TABLE IF NOT EXISTS sessions (
          app_name VARCHAR NOT NULL,
          user_id VARCHAR NOT NULL,
          id VARCHAR NOT NULL,
          state JSONB,
          create_time TIMESTAMP DEFAULT NOW(),
          update_time TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (app_name, user_id, id)
        );
      `;
      console.log('✅ Created ADK sessions table');
    }

    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_sessions_app_user ON sessions(app_name, user_id);
    `;
    
    const hasAuthSessions = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'auth_sessions'
      );
    `;
    
    if (hasAuthSessions[0]?.exists) {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
      `;
    }
    console.log('✅ Created indexes');

    // Create events table
    await sql`
      CREATE TABLE IF NOT EXISTS events (
        id VARCHAR PRIMARY KEY,
        app_name VARCHAR NOT NULL,
        user_id VARCHAR NOT NULL,
        session_id VARCHAR NOT NULL,
        invocation_id VARCHAR,
        author VARCHAR,
        actions BYTEA,
        content JSONB,
        timestamp TIMESTAMP DEFAULT NOW(),
        usage_metadata JSONB,
        citation_metadata JSONB,
        grounding_metadata JSONB,
        error_code VARCHAR,
        error_message VARCHAR,
        turn_complete BOOLEAN DEFAULT FALSE,
        partial BOOLEAN DEFAULT FALSE,
        interrupted BOOLEAN DEFAULT FALSE
      );
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_events_session ON events(app_name, user_id, session_id);
    `;
    console.log('✅ Created events table');

    // Create app_states and user_states tables
    await sql`
      CREATE TABLE IF NOT EXISTS app_states (
        app_name VARCHAR PRIMARY KEY,
        state JSONB,
        create_time TIMESTAMP DEFAULT NOW(),
        update_time TIMESTAMP DEFAULT NOW()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS user_states (
        app_name VARCHAR NOT NULL,
        user_id VARCHAR NOT NULL,
        state JSONB,
        create_time TIMESTAMP DEFAULT NOW(),
        update_time TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (app_name, user_id)
      );
    `;
    console.log('✅ Created app_states and user_states tables');

    console.log('\n✅ Migration completed successfully!\n');

    // Verify the fix
    console.log('🔍 Verifying migration...\n');
    const verifyResult = await sql`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_name IN ('sessions', 'auth_sessions')
      ORDER BY table_name, ordinal_position;
    `;

    console.log('Final table structure:');
    if (verifyResult.length > 0) {
      console.table(verifyResult);
    } else {
      console.log('⚠️  No tables found - something went wrong');
    }

    console.log('\n🎉 Done! Your ADK backend should now work correctly.');
  } catch (error) {
    console.error('❌ Error running migration:', error);
    throw error;
  }
}

fixSessionsTable()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

