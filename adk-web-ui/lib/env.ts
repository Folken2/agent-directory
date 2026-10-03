/** Fail the deploy, not the first request, when required config is missing. */
const REQUIRED = ['DATABASE_URL', 'ADK_SERVER_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] as const;

export function missingEnv(env: NodeJS.ProcessEnv): string[] {
  const missing: string[] = REQUIRED.filter((name) => !env[name]);
  if (!env.AUTH_SECRET && !env.NEXTAUTH_SECRET) missing.push('AUTH_SECRET (or NEXTAUTH_SECRET)');
  if (env.NODE_ENV === 'production' && !env.ADK_INTERNAL_TOKEN) missing.push('ADK_INTERNAL_TOKEN');
  return missing;
}

export function assertServerEnv(): void {
  if (process.env.SKIP_ENV_VALIDATION === 'true') return;
  const missing = missingEnv(process.env);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
