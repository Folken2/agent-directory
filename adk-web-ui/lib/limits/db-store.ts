import { sql } from 'drizzle-orm';
import { db } from '@/lib/drizzle/db';
import { unwrapExecuteRows } from '@/lib/drizzle/unwrap-rows';
import type { CounterStore } from './limiter';

let ensured: Promise<void> | null = null;

/** Idempotent bootstrap, once per process (see lib/analytics/ensure-schema.ts). */
function ensureSchema(): Promise<void> {
  if (!ensured) {
    ensured = db
      .execute(sql`
        CREATE TABLE IF NOT EXISTS "rate_limit_counters" (
          "key" text NOT NULL,
          "day" date NOT NULL,
          "count" integer NOT NULL DEFAULT 0,
          "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
          PRIMARY KEY ("key", "day")
        )
      `)
      .then(() => undefined)
      .catch((error) => {
        ensured = null;
        throw error;
      });
  }
  return ensured;
}

export const dbCounterStore: CounterStore = {
  async tryIncrement(key, limit, day) {
    await ensureSchema();
    // ON CONFLICT DO UPDATE row-locks and re-checks the WHERE against the
    // latest committed count, so concurrent requests serialize per bucket.
    const rows = unwrapExecuteRows<{ count: number }>(
      await db.execute(sql`
        INSERT INTO rate_limit_counters ("key", "day", "count")
        VALUES (${key}, ${day}::date, 1)
        ON CONFLICT ("key", "day") DO UPDATE
          SET "count" = rate_limit_counters."count" + 1, "updated_at" = now()
          WHERE rate_limit_counters."count" < ${limit}
        RETURNING "count"
      `)
    );
    return rows.length > 0;
  },
  async decrement(key, day) {
    await ensureSchema();
    await db.execute(sql`
      UPDATE rate_limit_counters
      SET "count" = GREATEST("count" - 1, 0), "updated_at" = now()
      WHERE "key" = ${key} AND "day" = ${day}::date
    `);
  },
};
