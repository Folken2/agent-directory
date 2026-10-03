/** Fail the deploy, not the first request, when required config is missing. */
const ALWAYS_REQUIRED = ['DATABASE_URL'] as const;
// ADK_SERVER_URL falls back to localhost:8000 in development (see adk-config.ts), and
// Google creds only affect sign-in, so these only need to be set for production.
const PRODUCTION_ONLY_REQUIRED = [
  'ADK_SERVER_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'ADK_INTERNAL_TOKEN',
] as const;

export function missingEnv(env: NodeJS.ProcessEnv): string[] {
  const required: readonly string[] =
    env.NODE_ENV === 'production'
      ? [...ALWAYS_REQUIRED, ...PRODUCTION_ONLY_REQUIRED]
      : ALWAYS_REQUIRED;
  const missing: string[] = required.filter((name) => !env[name]);
  if (!env.AUTH_SECRET && !env.NEXTAUTH_SECRET) missing.push('AUTH_SECRET (or NEXTAUTH_SECRET)');
  return missing;
}

export function assertServerEnv(): void {
  if (process.env.SKIP_ENV_VALIDATION === 'true') return;
  const missing = missingEnv(process.env);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
