import { json } from "../lib/responses.js";
import { getRuntimeConfig } from "../lib/config.js";
import { clearSessionSetCookie, createSessionSetCookie, readSession } from "../lib/session.js";
import { homePayload, people, personPayload, postsPayload } from "../mock/data.js";
import {
  createPost,
  deletePostById,
  fetchHomeData,
  fetchPersonData,
  fetchPostsData,
  saveComment,
  saveDday,
  saveMood,
  updatePost,
} from "./realData.js";

function buildSessionPayload(runtime, session) {
  return {
    authenticated: Boolean(session.authenticated),
    currentUser: session.currentUser || null,
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
  const session = await readSession(request, env);

  if (url.pathname === "/api/v1/health") {
    return json({ status: "ok", service: "secret-homepage-cloudflare", now: new Date().toISOString(), runtime });
  }

  if (url.pathname === "/api/v1/session") {
    return json(buildSessionPayload(runtime, session));
  }

  if (request.method === "POST" && url.pathname === "/api/v1/login") {
    try {
      const body = await request.json();
      const password = String(body?.password || "");
      if (!env.SITE_PASSWORD || password !== env.SITE_PASSWORD) {
        return json({ error: "LOGIN_FAILED", detail: "비밀번호가 일치하지 않습니다.", runtime }, { status: 401 });
      }
      const headers = new Headers();
      headers.append("Set-Cookie", await createSessionSetCookie(env, { authenticated: true, currentUser: null }));
      return json({ ok: true, session: buildSessionPayload(runtime, { authenticated: true, currentUser: null }) }, { headers });
    } catch (error) {
      return json({ error: "LOGIN_FAILED", detail: String(error), runtime }, { status: 500 });
    }
  }

  if (request.method === "POST" && url.pathname === "/api/v1/whoami") {
    try {
      if (!session.authenticated) {
        return json({ error: "AUTH_REQUIRED", detail: "먼저 비밀번호를 입력해주세요.", runtime }, { status: 401 });
      }
      const body = await request.json();
      const currentUser = body?.currentUser;
      if (!["you", "partner"].includes(currentUser)) {
        return json({ error: "INVALID_USER", detail: "구현 또는 지원을 선택해주세요.", runtime }, { status: 400 });
      }
      const headers = new Headers();
      headers.append("Set-Cookie", await createSessionSetCookie(env, { authenticated: true, currentUser }));
      return json({ ok: true, session: buildSessionPayload(runtime, { authenticated: true, currentUser }) }, { headers });
    } catch (error) {
      return json({ error: "WHOAMI_FAILED", detail: String(error), runtime }, { status: 500 });
    }
  }

  if (request.method === "POST" && url.pathname === "/api/v1/logout") {
    const headers = new Headers();
    headers.append("Set-Cookie", clearSessionSetCookie());
    return json({ ok: true }, { headers });
  }

  if (!session.authenticated) {
    return json({ error: "AUTH_REQUIRED", detail: "로그인이 필요합니다.", runtime }, { status: 401 });
  }

  if (!session.currentUser) {
    return json({ error: "IDENTITY_REQUIRED", detail: "현재 사용자를 먼저 선택해주세요.", runtime }, { status: 403 });
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

  const personGetMatch = request.method === "GET" ? url.pathname.match(/^\/api\/v1\/person\/(you|partner)$/) : null;
  if (personGetMatch) {
    if (!useReal) return json({ ...personPayload, mode: runtime.mode, runtime });
    try {
      const person = await fetchPersonData(env, {
        owner: personGetMatch[1],
        page: url.searchParams.get("page") || 1,
        perPage: url.searchParams.get("perPage") || 15,
      });
      return json({ ...person, mode: runtime.mode, runtime });
    } catch (error) {
      return json({ error: "PERSON_FETCH_FAILED", detail: String(error), runtime }, { status: 500 });
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

  const personCreateMatch = request.method === "POST" ? url.pathname.match(/^\/api\/v1\/person\/(you|partner)\/posts$/) : null;
  if (personCreateMatch) {
    try {
      const body = await request.json();
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode, body });
      if (personCreateMatch[1] !== session.currentUser) {
        return json({ error: "POST_CREATE_FAILED", detail: "자신의 페이지에서만 글을 작성할 수 있습니다.", runtime }, { status: 403 });
      }
      const person = await createPost(env, {
        owner: personCreateMatch[1],
        content: body?.content,
        recordDate: body?.recordDate,
      });
      return json({ ok: true, saved: true, mode: runtime.mode, person });
    } catch (error) {
      return json({ error: "POST_CREATE_FAILED", detail: String(error), runtime }, { status: 500 });
    }
  }

  if (request.method === "POST" && url.pathname === "/api/v1/moods") {
    try {
      const body = await request.json();
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode, body });
      const home = await saveMood(env, { owner: session.currentUser, moodId: body?.moodId });
      return json({ ok: true, saved: true, mode: runtime.mode, home });
    } catch (error) {
      return json({ error: "MOOD_SAVE_FAILED", detail: String(error), runtime }, { status: 500 });
    }
  }

  if (request.method === "POST" && url.pathname === "/api/v1/dday") {
    try {
      const body = await request.json();
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode, body });
      const home = await saveDday(env, {
        title: body?.title,
        startDate: body?.startDate,
        targetDate: body?.targetDate,
      });
      return json({ ok: true, saved: true, mode: runtime.mode, home });
    } catch (error) {
      return json({ error: "DDAY_SAVE_FAILED", detail: String(error), runtime }, { status: 500 });
    }
  }

  const commentMatch = request.method === "POST" ? url.pathname.match(/^\/api\/v1\/posts\/(\d+)\/comments$/) : null;
  if (commentMatch) {
    try {
      const body = await request.json();
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode, body });
      const posts = await saveComment(env, {
        postId: Number(commentMatch[1]),
        author: session.currentUser,
        content: body?.content,
      });
      return json({ ok: true, saved: true, mode: runtime.mode, posts });
    } catch (error) {
      return json({ error: "COMMENT_SAVE_FAILED", detail: String(error), runtime }, { status: 500 });
    }
  }

  const editMatch = request.method === "POST" ? url.pathname.match(/^\/api\/v1\/posts\/(\d+)\/edit$/) : null;
  if (editMatch) {
    try {
      const body = await request.json();
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode, body });
      const person = await updatePost(env, {
        postId: Number(editMatch[1]),
        owner: session.currentUser,
        content: body?.content,
        recordDate: body?.recordDate,
      });
      return json({ ok: true, saved: true, mode: runtime.mode, person });
    } catch (error) {
      return json({ error: "POST_EDIT_FAILED", detail: String(error), runtime }, { status: 500 });
    }
  }

  const deleteMatch = request.method === "POST" ? url.pathname.match(/^\/api\/v1\/posts\/(\d+)\/delete$/) : null;
  if (deleteMatch) {
    try {
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode });
      const person = await deletePostById(env, {
        postId: Number(deleteMatch[1]),
        owner: session.currentUser,
      });
      return json({ ok: true, saved: true, mode: runtime.mode, person });
    } catch (error) {
      return json({ error: "POST_DELETE_FAILED", detail: String(error), runtime }, { status: 500 });
    }
  }

  return null;
}
