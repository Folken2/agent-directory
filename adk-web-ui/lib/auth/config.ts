import GoogleProvider from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/lib/drizzle/db';
import { users, accounts, sessions, verificationTokens } from '@/lib/drizzle/schema';
import type { JWT } from 'next-auth/jwt';
import type { Session, User } from 'next-auth';
import type { AdapterUser } from '@auth/core/adapters';

// Validate required environment variables
const requiredEnvVars = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  AUTH_SECRET: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error(
    `⚠️  Missing required environment variables: ${missingVars.join(', ')}`
  );
  console.error(
    'Please set these in your .env.local file. See GOOGLE_OAUTH_SETUP.md for details.'
  );
}

// Only use DrizzleAdapter if DATABASE_URL is available
const useDatabaseAdapter = Boolean(process.env.DATABASE_URL);

export const authConfig = {
  ...(useDatabaseAdapter && {
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
  }),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          scope: 'openid email profile',
        },
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: (useDatabaseAdapter ? 'database' : 'jwt') as 'database' | 'jwt',
  },
  callbacks: {
    async jwt({
      token,
      user,
      account,
      profile,
    }: {
      token: JWT;
      user?: User | AdapterUser;
      account?: { provider: string; type: string } | null;
      profile?: Record<string, unknown>;
    }) {
      // Initial sign in - extract user data from OAuth profile
      if (account && profile) {
        token.id = (user?.id as string | undefined) || (profile.sub as string | undefined);
        token.email = (profile.email as string | undefined) || token.email;
        token.name = (profile.name as string | undefined) || token.name;
        token.picture = (profile.picture as string | undefined) || token.picture;
        token.role = (user as { role?: 'user' | 'admin' })?.role || 'user';
      }
      // Database strategy - user object is available
      if (user && user.id) {
        token.id = user.id;
        token.role = (user as { role?: 'user' | 'admin' }).role || 'user';
      }
      return token;
    },
    async session({
      session,
      token,
      user,
    }: {
      session: Session;
      token: JWT;
      user?: User | AdapterUser;
    }) {
      // For database strategy
      if (user && user.id) {
        session.user.id = user.id;
        session.user.role = (user as { role?: 'user' | 'admin' }).role || 'user';
        // Ensure name and email are set from user object
        const adapterUser = user as AdapterUser & { name?: string; email?: string };
        if (!session.user.name && adapterUser.name) {
          session.user.name = adapterUser.name;
        }
        if (!session.user.email && adapterUser.email) {
          session.user.email = adapterUser.email;
        }
      }
      // For JWT strategy (fallback or when database strategy doesn't provide user)
      if (token) {
        // Only set id if it exists and user.id wasn't already set
        if (token.id && typeof token.id === 'string') {
          session.user.id = token.id;
        } else if (!session.user.id) {
          // Fallback: use token.sub or empty string
          session.user.id = (token.sub as string) || '';
        }
        session.user.role = (token.role as 'user' | 'admin') || 'user';
        // Ensure name and email are set from token
        if (token.name && typeof token.name === 'string') {
          session.user.name = token.name;
        }
        if (token.email && typeof token.email === 'string') {
          session.user.email = token.email;
        }
        if (token.picture && typeof token.picture === 'string') {
          session.user.image = token.picture;
        }
      }
      return session;
    },
  },
  debug: process.env.NODE_ENV === 'development',
};
