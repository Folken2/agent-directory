/** Fail the deploy, not the first request, when required config is missing. */
const ALWAYS_REQUIRED = ['DATABASE_URL'] as const;
// ADK_SERVER_URL falls back to localhost:8000 in development (see adk-config.ts), and
// Google creds only affect sign-in, so these only need to be set for production.
const PRODUCTION_ONLY_REQUIRED = ['ADK_SERVER_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] as const;

export function missingEnv(env: NodeJS.ProcessEnv): string[] {
  const required: readonly string[] =
    env.NODE_ENV === 'production'
      ? [...ALWAYS_REQUIRED, ...PRODUCTION_ONLY_REQUIRED]
      : ALWAYS_REQUIRED;
  const missing: string[] = required.filter((name) => !env[name]);
  if (!env.AUTH_SECRET && !env.NEXTAUTH_SECRET) missing.push('AUTH_SECRET (or NEXTAUTH_SECRET)');
  return missing;
}

// Temporary: when the ADK backend enforces X-Internal-Token, move ADK_INTERNAL_TOKEN back into missingEnv() for production in that same change.
export function envWarnings(env: NodeJS.ProcessEnv): string[] {
  const warnings: string[] = [];
  if (env.NODE_ENV === 'production' && !env.ADK_INTERNAL_TOKEN) {
    warnings.push('ADK_INTERNAL_TOKEN is not set; backend calls are not authenticated');
  }
  return warnings;
}

export function assertServerEnv(): void {
  if (process.env.SKIP_ENV_VALIDATION === 'true') return;
  const warnings = envWarnings(process.env);
  for (const w of warnings) {
    console.warn(`[boot] ${w}`);
  }
  const missing = missingEnv(process.env);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
