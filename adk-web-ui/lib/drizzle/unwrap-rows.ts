/**
 * `db.execute` returns a bare array on some drivers and `{ rows }` on others
 * (neon-http vs node-postgres). Normalize before use.
 */
export function unwrapExecuteRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object' && 'rows' in result) {
    return (result as { rows: T[] }).rows ?? [];
  }
  return [];
}
