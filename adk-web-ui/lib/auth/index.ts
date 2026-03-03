import NextAuth from 'next-auth';
import { authConfig } from './config';

// Type assertion to bypass @auth/core version mismatch between next-auth and @auth/drizzle-adapter
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig as any);

