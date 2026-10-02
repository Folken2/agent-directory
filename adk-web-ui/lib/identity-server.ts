import { randomBytes } from 'crypto';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { extractClientIp, hashIp } from '@/lib/analytics/hash-ip';
import { resolveIdentityWith, type ResolvedIdentity } from './identity';

export function resolveIdentity(request: NextRequest): Promise<ResolvedIdentity> {
  return resolveIdentityWith({
    getUserId: async () => (await auth())?.user?.id ?? null,
    readCookie: (name) => request.cookies.get(name)?.value,
    ipHash: () => hashIp(extractClientIp(request.headers)),
    mintToken: () => randomBytes(32).toString('hex'),
  });
}
