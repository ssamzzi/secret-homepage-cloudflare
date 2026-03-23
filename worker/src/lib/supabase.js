const DEFAULT_HEADERS = {
  "content-type": "application/json",
};

function buildUrl(env, path, params = {}) {
  const url = new URL(`/rest/v1/${path}`, env.SUPABASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function supabaseFetch(env, path, { method = "GET", params = {}, headers = {}, body } = {}) {
  const url = buildUrl(env, path, params);
  const response = await fetch(url, {
    method,
    headers: {
      ...DEFAULT_HEADERS,
      apikey: env.SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${text}`);
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { data, headers: response.headers };
}

export async function fetchRows(env, path, options = {}) {
  return supabaseFetch(env, path, options);
}

export function getRequiredSupabaseEnv(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error("SUPABASE_URL or SUPABASE_SECRET_KEY is missing");
  }
}
