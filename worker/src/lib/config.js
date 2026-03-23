export function getRuntimeConfig(env = {}) {
  return {
    mode: env.DATA_MODE || "mock",
    hasDatabaseUrl: Boolean(env.DATABASE_URL),
    hasSitePassword: Boolean(env.SITE_PASSWORD),
    hasSessionSecret: Boolean(env.SESSION_SECRET),
    displayTimezone: env.DISPLAY_TIMEZONE || "Asia/Seoul",
  };
}
