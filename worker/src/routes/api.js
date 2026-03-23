import { json } from "../lib/responses.js";
import { getRuntimeConfig } from "../lib/config.js";
import { people, homePayload, postsPayload } from "../mock/data.js";
import { fetchHomeData, fetchPostsData } from "./realData.js";

function mockSession(runtime) {
  return {
    authenticated: true,
    currentUser: "you",
    people,
    notificationUnread: 0,
    mode: runtime.mode,
    runtime,
  };
}

export async function handleApi(request, env) {
  const url = new URL(request.url);
  const runtime = getRuntimeConfig(env);
  const useReal = runtime.mode === "real";

  if (url.pathname === "/api/v1/health") {
    return json({ status: "ok", service: "secret-homepage-cloudflare", now: new Date().toISOString(), runtime });
  }

  if (url.pathname === "/api/v1/session") {
    return json(mockSession(runtime));
  }

  if (url.pathname === "/api/v1/home") {
    if (!useReal) return json({ ...homePayload, mode: runtime.mode, runtime });
    try {
      const home = await fetchHomeData(env, url.searchParams.get("month") || "");
      return json({ ...home, mode: runtime.mode, runtime });
    } catch (error) {
      return json({ error: "HOME_FETCH_FAILED", detail: String(error), runtime }, { status: 500 });
    }
  }

  if (url.pathname === "/api/v1/posts") {
    if (!useReal) return json({ ...postsPayload, mode: runtime.mode, runtime });
    try {
      const posts = await fetchPostsData(env, {
        page: url.searchParams.get("page") || 1,
        perPage: url.searchParams.get("perPage") || 6,
      });
      return json({ ...posts, mode: runtime.mode, runtime });
    } catch (error) {
      return json({ error: "POSTS_FETCH_FAILED", detail: String(error), runtime }, { status: 500 });
    }
  }

  if (request.method === "POST" && url.pathname === "/api/v1/moods") {
    return json({ ok: true, saved: true, mode: runtime.mode });
  }

  if (request.method === "POST" && url.pathname === "/api/v1/dday") {
    return json({ ok: true, saved: true, mode: runtime.mode });
  }

  return null;
}
