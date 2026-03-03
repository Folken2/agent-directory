import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/drizzle/schema/*',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});
