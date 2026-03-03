/**
 * Script to fix sessions table conflict between NextAuth and ADK
 * 
 * This script:
 * 1. Renames NextAuth sessions table to auth_sessions
 * 2. Creates ADK sessions table with app_name column
 * 3. Creates other required ADK tables (events, app_states, user_states)
 * 
 * Run with: npx tsx scripts/fix-sessions-table.ts
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

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
    console.table(checkResult);

    console.log('\n🔧 Running migration...\n');

    // Run the fix
    await sql`
      BEGIN;
    `;

    // Rename NextAuth sessions to auth_sessions
    await sql`
      ALTER TABLE IF EXISTS sessions RENAME TO auth_sessions;
    `;
    console.log('✅ Renamed sessions → auth_sessions');

    // Create ADK sessions table
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

    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_sessions_app_user ON sessions(app_name, user_id);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
    `;
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

    await sql`
      COMMIT;
    `;

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
    console.table(verifyResult);

    console.log('\n🎉 Done! Your ADK backend should now work correctly.');
  } catch (error) {
    console.error('❌ Error running migration:', error);
    await sql`ROLLBACK;`;
    process.exit(1);
  }
}

fixSessionsTable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

