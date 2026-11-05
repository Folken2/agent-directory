import { DefaultSession } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'user' | 'admin';
      /** Shows the Analytics link only; the pages check the allowlist themselves. */
      canViewAnalytics?: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    role: 'user' | 'admin';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: 'user' | 'admin';
  }
}

