export function getRuntimeConfig(env = {}) {
  return {
    mode: env.DATA_MODE || "mock",
    hasDatabaseUrl: Boolean(env.DATABASE_URL),
    hasSitePassword: Boolean(env.SITE_PASSWORD),
    hasSessionSecret: Boolean(env.SESSION_SECRET),
    hasSupabaseUrl: Boolean(env.SUPABASE_URL),
    hasSupabaseSecretKey: Boolean(env.SUPABASE_SECRET_KEY),
    displayTimezone: env.DISPLAY_TIMEZONE || "Asia/Seoul",
  };
}
