import { json } from "../lib/responses.js";
import { getRuntimeConfig } from "../lib/config.js";
import { people, homePayload, postsPayload } from "../mock/data.js";

export function handleApi(request, env) {
  const url = new URL(request.url);
  const runtime = getRuntimeConfig(env);

  if (url.pathname === "/api/v1/health") {
    return json({ status: "ok", service: "secret-homepage-cloudflare", now: new Date().toISOString(), runtime });
  }

  if (url.pathname === "/api/v1/session") {
    return json({
      authenticated: true,
      currentUser: "you",
      people,
      notificationUnread: 0,
      mode: runtime.mode,
      runtime,
    });
  }

  if (url.pathname === "/api/v1/home") {
    return json({ ...homePayload, mode: runtime.mode, runtime });
  }

  if (url.pathname === "/api/v1/posts") {
    return json({ ...postsPayload, mode: runtime.mode, runtime });
  }

  if (request.method === "POST" && url.pathname === "/api/v1/moods") {
    return json({ ok: true, saved: true, mode: runtime.mode });
  }

  if (request.method === "POST" && url.pathname === "/api/v1/dday") {
    return json({ ok: true, saved: true, mode: runtime.mode });
  }

  return null;
}
