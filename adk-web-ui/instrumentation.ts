export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertServerEnv } = await import('./lib/env');
    try {
      assertServerEnv();
    } catch (error) {
      console.error(`[boot] ${(error as Error).message}`);
      process.exit(1);
    }
  }
}
