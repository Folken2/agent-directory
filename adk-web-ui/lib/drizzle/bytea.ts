import { customType } from 'drizzle-orm/pg-core';

/**
 * Postgres `bytea` as a Buffer. Drivers differ in what they hand back: a
 * Buffer, a Uint8Array, or the text form `\x<hex>`; normalize all three.
 * (neon-http sends Buffer parameters as `\x<hex>` itself.)
 */
export function byteaToBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string' && value.startsWith('\\x')) return Buffer.from(value.slice(2), 'hex');
  throw new TypeError('unexpected bytea value');
}

export const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array | string }>({
  dataType() {
    return 'bytea';
  },
  toDriver(value: Buffer) {
    return value;
  },
  fromDriver(value: Buffer | Uint8Array | string) {
    return byteaToBuffer(value);
  },
});
