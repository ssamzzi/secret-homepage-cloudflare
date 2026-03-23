export function getRuntimeConfig(env = {}) {
  const explicitMode = String(env.DATA_MODE || "").trim().toLowerCase();
  const hasSupabaseUrl = Boolean(env.SUPABASE_URL);
  const hasSupabaseSecretKey = Boolean(env.SUPABASE_SECRET_KEY);
  const inferredMode = hasSupabaseUrl && hasSupabaseSecretKey ? "real" : "mock";

  return {
    mode: explicitMode || inferredMode,
    hasDatabaseUrl: Boolean(env.DATABASE_URL),
    hasSitePassword: Boolean(env.SITE_PASSWORD),
    hasSessionSecret: Boolean(env.SESSION_SECRET),
    hasSupabaseUrl,
    hasSupabaseSecretKey,
    displayTimezone: env.DISPLAY_TIMEZONE || "Asia/Seoul",
  };
}
