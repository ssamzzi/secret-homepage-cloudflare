import { json } from "../lib/responses.js";
import { getRuntimeConfig } from "../lib/config.js";
import { clearSessionSetCookie, createSessionSetCookie, readSession } from "../lib/session.js";
import { backupPayload, bucketPayload, homePayload, notificationsPayload, people, personPayload, postsPayload, qnaPayload } from "../mock/data.js";
import {
  clearAnswerByQuestionId,
  createBucketItem,
  createPost,
  createQuestion,
  deleteCommentById,
  deleteBucketItemById,
  deletePostById,
  deleteQuestionById,
  editQuestionById,
  exportBackupData,
  fetchBucketData,
  fetchHomeData,
  fetchNotificationsData,
  fetchPersonData,
  fetchPostsData,
  fetchQnaData,
  importBackupData,
  saveAnswerByQuestionId,
  saveComment,
  saveDday,
  saveMood,
  toggleBucketItemById,
  updateComment,
  updatePost,
} from "./realData.js";
import { uploadImageToCloudinary } from "../lib/cloudinary.js";

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

  if (url.pathname === "/api/v1/health") return json({ status: "ok", service: "secret-homepage-cloudflare", now: new Date().toISOString(), runtime });
  if (url.pathname === "/api/v1/session") return json(buildSessionPayload(runtime, session));

  if (request.method === "POST" && url.pathname === "/api/v1/login") {
    try {
      const body = await request.json();
      const password = String(body?.password || "");
      if (!env.SITE_PASSWORD || password !== env.SITE_PASSWORD) return json({ error: "LOGIN_FAILED", detail: "비밀번호가 일치하지 않습니다.", runtime }, { status: 401 });
      const headers = new Headers();
      headers.append("Set-Cookie", await createSessionSetCookie(env, { authenticated: true, currentUser: null }));
      return json({ ok: true, session: buildSessionPayload(runtime, { authenticated: true, currentUser: null }) }, { headers });
    } catch (error) {
      return json({ error: "LOGIN_FAILED", detail: String(error), runtime }, { status: 500 });
    }
  }

  if (request.method === "POST" && url.pathname === "/api/v1/whoami") {
    try {
      if (!session.authenticated) return json({ error: "AUTH_REQUIRED", detail: "먼저 비밀번호를 입력해주세요.", runtime }, { status: 401 });
      const body = await request.json();
      const currentUser = body?.currentUser;
      if (!["you", "partner"].includes(currentUser)) return json({ error: "INVALID_USER", detail: "구현 또는 지원을 선택해주세요.", runtime }, { status: 400 });
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

  if (!session.authenticated) return json({ error: "AUTH_REQUIRED", detail: "로그인이 필요합니다.", runtime }, { status: 401 });
  if (!session.currentUser) return json({ error: "IDENTITY_REQUIRED", detail: "현재 사용자를 먼저 선택해주세요.", runtime }, { status: 403 });

  if (url.pathname === "/api/v1/home") {
    if (!useReal) return json({ ...homePayload, mode: runtime.mode, runtime });
    try { return json({ ...(await fetchHomeData(env, url.searchParams.get("month") || "")), mode: runtime.mode, runtime }); }
    catch (error) { return json({ error: "HOME_FETCH_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  const personGetMatch = request.method === "GET" ? url.pathname.match(/^\/api\/v1\/person\/(you|partner)$/) : null;
  if (personGetMatch) {
    if (!useReal) return json({ ...personPayload, mode: runtime.mode, runtime });
    try { return json({ ...(await fetchPersonData(env, { owner: personGetMatch[1], page: url.searchParams.get("page") || 1, perPage: url.searchParams.get("perPage") || 15 })), mode: runtime.mode, runtime }); }
    catch (error) { return json({ error: "PERSON_FETCH_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  if (url.pathname === "/api/v1/posts") {
    if (!useReal) return json({ ...postsPayload, mode: runtime.mode, runtime });
    try { return json({ ...(await fetchPostsData(env, { page: url.searchParams.get("page") || 1, perPage: url.searchParams.get("perPage") || 6 })), mode: runtime.mode, runtime }); }
    catch (error) { return json({ error: "POSTS_FETCH_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  if (request.method === "GET" && url.pathname === "/api/v1/bucket") {
    if (!useReal) return json({ ...bucketPayload, mode: runtime.mode, runtime });
    try { return json({ ...(await fetchBucketData(env, { actor: session.currentUser, ownerFilter: url.searchParams.get("owner") || "all", statusFilter: url.searchParams.get("status") || "all", page: url.searchParams.get("page") || 1, perPage: 15 })), mode: runtime.mode, runtime }); }
    catch (error) { return json({ error: "BUCKET_FETCH_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  if (request.method === "GET" && url.pathname === "/api/v1/qna") {
    if (!useReal) return json({ ...qnaPayload, mode: runtime.mode, runtime });
    try { return json({ ...(await fetchQnaData(env, { actor: session.currentUser, scopeFilter: url.searchParams.get("scope") || "all", progressFilter: url.searchParams.get("progress") || "all", page: url.searchParams.get("page") || 1, perPage: 15 })), mode: runtime.mode, runtime }); }
    catch (error) { return json({ error: "QNA_FETCH_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  if (request.method === "GET" && url.pathname === "/api/v1/notifications") {
    if (!useReal) return json({ ...notificationsPayload, mode: runtime.mode, runtime });
    try { return json({ ...(await fetchNotificationsData(env, { actor: session.currentUser, limit: 100 })), mode: runtime.mode, runtime }); }
    catch (error) { return json({ error: "NOTIFICATIONS_FETCH_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  if (request.method === "GET" && url.pathname === "/api/v1/backup/export") {
    try {
      const payload = useReal ? await exportBackupData(env) : backupPayload;
      const content = JSON.stringify(payload, null, 2);
      return new Response(content, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename=\"secret-homepage-backup-${new Date().toISOString().slice(0, 10)}.json\"`,
          "cache-control": "no-store",
        },
      });
    } catch (error) {
      return json({ error: "BACKUP_EXPORT_FAILED", detail: String(error), runtime }, { status: 500 });
    }
  }

  const personCreateMatch = request.method === "POST" ? url.pathname.match(/^\/api\/v1\/person\/(you|partner)\/posts$/) : null;
  if (personCreateMatch) {
    try {
      let payload;
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("multipart/form-data")) {
        const form = await request.formData();
        const files = form.getAll("images").filter((value) => typeof value !== "string" && value?.size);
        const imageUrls = [];
        if (useReal) {
          for (const file of files) {
            imageUrls.push(await uploadImageToCloudinary(env, file));
          }
        }
        payload = {
          recordDate: String(form.get("recordDate") || ""),
          content: String(form.get("content") || "").trim(),
          imageUrls,
        };
      } else {
        const body = await request.json();
        payload = {
          recordDate: body?.recordDate,
          content: body?.content,
          imageUrls: Array.isArray(body?.imageUrls) ? body.imageUrls : [],
        };
      }
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode, body: payload });
      if (personCreateMatch[1] !== session.currentUser) return json({ error: "POST_CREATE_FAILED", detail: "자신의 페이지에서만 글을 작성할 수 있습니다.", runtime }, { status: 403 });
      return json({ ok: true, saved: true, mode: runtime.mode, person: await createPost(env, { owner: personCreateMatch[1], content: payload.content, recordDate: payload.recordDate, imageUrls: payload.imageUrls }) });
    } catch (error) { return json({ error: "POST_CREATE_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  if (request.method === "POST" && url.pathname === "/api/v1/moods") {
    try {
      const body = await request.json();
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode, body });
      return json({ ok: true, saved: true, mode: runtime.mode, home: await saveMood(env, { owner: session.currentUser, moodId: body?.moodId }) });
    } catch (error) { return json({ error: "MOOD_SAVE_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  if (request.method === "POST" && url.pathname === "/api/v1/dday") {
    try {
      const body = await request.json();
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode, body });
      return json({ ok: true, saved: true, mode: runtime.mode, home: await saveDday(env, { title: body?.title, startDate: body?.startDate, targetDate: body?.targetDate }) });
    } catch (error) { return json({ error: "DDAY_SAVE_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  if (request.method === "POST" && url.pathname === "/api/v1/bucket") {
    try {
      const body = await request.json();
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode, body });
      return json({ ok: true, saved: true, mode: runtime.mode, bucket: await createBucketItem(env, { owner: session.currentUser, content: body?.content }) });
    } catch (error) { return json({ error: "BUCKET_CREATE_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  const bucketToggleMatch = request.method === "POST" ? url.pathname.match(/^\/api\/v1\/bucket\/(\d+)\/toggle$/) : null;
  if (bucketToggleMatch) {
    try {
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode });
      return json({ ok: true, saved: true, mode: runtime.mode, bucket: await toggleBucketItemById(env, { itemId: Number(bucketToggleMatch[1]), actor: session.currentUser }) });
    } catch (error) { return json({ error: "BUCKET_TOGGLE_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  const bucketDeleteMatch = request.method === "POST" ? url.pathname.match(/^\/api\/v1\/bucket\/(\d+)\/delete$/) : null;
  if (bucketDeleteMatch) {
    try {
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode });
      return json({ ok: true, saved: true, mode: runtime.mode, bucket: await deleteBucketItemById(env, { itemId: Number(bucketDeleteMatch[1]), actor: session.currentUser }) });
    } catch (error) { return json({ error: "BUCKET_DELETE_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  if (request.method === "POST" && url.pathname === "/api/v1/qna") {
    try {
      const body = await request.json();
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode, body });
      return json({ ok: true, saved: true, mode: runtime.mode, qna: await createQuestion(env, { actor: session.currentUser, question: body?.question }) });
    } catch (error) { return json({ error: "QNA_CREATE_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  if (request.method === "POST" && url.pathname === "/api/v1/backup/import") {
    try {
      if (!useReal) return json({ ok: true, restored: true, mode: runtime.mode });
      const form = await request.formData();
      const file = form.get("backup_file");
      if (!file || typeof file === "string") return json({ error: "BACKUP_IMPORT_FAILED", detail: "백업 파일을 선택해주세요.", runtime }, { status: 400 });
      const text = await file.text();
      const payload = JSON.parse(text);
      await importBackupData(env, payload);
      return json({ ok: true, restored: true, mode: runtime.mode });
    } catch (error) { return json({ error: "BACKUP_IMPORT_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  const questionEditMatch = request.method === "POST" ? url.pathname.match(/^\/api\/v1\/qna\/(\d+)\/edit$/) : null;
  if (questionEditMatch) {
    try {
      const body = await request.json();
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode, body });
      return json({ ok: true, saved: true, mode: runtime.mode, qna: await editQuestionById(env, { questionId: Number(questionEditMatch[1]), actor: session.currentUser, question: body?.question }) });
    } catch (error) { return json({ error: "QNA_EDIT_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  const questionDeleteMatch = request.method === "POST" ? url.pathname.match(/^\/api\/v1\/qna\/(\d+)\/delete$/) : null;
  if (questionDeleteMatch) {
    try {
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode });
      return json({ ok: true, saved: true, mode: runtime.mode, qna: await deleteQuestionById(env, { questionId: Number(questionDeleteMatch[1]), actor: session.currentUser }) });
    } catch (error) { return json({ error: "QNA_DELETE_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  const answerSaveMatch = request.method === "POST" ? url.pathname.match(/^\/api\/v1\/qna\/(\d+)\/answer$/) : null;
  if (answerSaveMatch) {
    try {
      const body = await request.json();
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode, body });
      return json({ ok: true, saved: true, mode: runtime.mode, qna: await saveAnswerByQuestionId(env, { questionId: Number(answerSaveMatch[1]), actor: session.currentUser, answer: body?.answer }) });
    } catch (error) { return json({ error: "QNA_ANSWER_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  const answerDeleteMatch = request.method === "POST" ? url.pathname.match(/^\/api\/v1\/qna\/(\d+)\/answer\/delete$/) : null;
  if (answerDeleteMatch) {
    try {
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode });
      return json({ ok: true, saved: true, mode: runtime.mode, qna: await clearAnswerByQuestionId(env, { questionId: Number(answerDeleteMatch[1]), actor: session.currentUser }) });
    } catch (error) { return json({ error: "QNA_ANSWER_DELETE_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  const commentMatch = request.method === "POST" ? url.pathname.match(/^\/api\/v1\/posts\/(\d+)\/comments$/) : null;
  if (commentMatch) {
    try {
      const body = await request.json();
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode, body });
      return json({ ok: true, saved: true, mode: runtime.mode, posts: await saveComment(env, { postId: Number(commentMatch[1]), author: session.currentUser, content: body?.content }) });
    } catch (error) { return json({ error: "COMMENT_SAVE_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  const commentEditMatch = request.method === "POST" ? url.pathname.match(/^\/api\/v1\/comments\/(\d+)\/edit$/) : null;
  if (commentEditMatch) {
    try {
      const body = await request.json();
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode, body });
      return json({ ok: true, saved: true, mode: runtime.mode, posts: await updateComment(env, { commentId: Number(commentEditMatch[1]), author: session.currentUser, content: body?.content }) });
    } catch (error) { return json({ error: "COMMENT_EDIT_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  const commentDeleteMatch = request.method === "POST" ? url.pathname.match(/^\/api\/v1\/comments\/(\d+)\/delete$/) : null;
  if (commentDeleteMatch) {
    try {
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode });
      return json({ ok: true, saved: true, mode: runtime.mode, posts: await deleteCommentById(env, { commentId: Number(commentDeleteMatch[1]), author: session.currentUser }) });
    } catch (error) { return json({ error: "COMMENT_DELETE_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  const editMatch = request.method === "POST" ? url.pathname.match(/^\/api\/v1\/posts\/(\d+)\/edit$/) : null;
  if (editMatch) {
    try {
      const body = await request.json();
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode, body });
      return json({ ok: true, saved: true, mode: runtime.mode, person: await updatePost(env, { postId: Number(editMatch[1]), owner: session.currentUser, content: body?.content, recordDate: body?.recordDate }) });
    } catch (error) { return json({ error: "POST_EDIT_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  const deleteMatch = request.method === "POST" ? url.pathname.match(/^\/api\/v1\/posts\/(\d+)\/delete$/) : null;
  if (deleteMatch) {
    try {
      if (!useReal) return json({ ok: true, saved: true, mode: runtime.mode });
      return json({ ok: true, saved: true, mode: runtime.mode, person: await deletePostById(env, { postId: Number(deleteMatch[1]), owner: session.currentUser }) });
    } catch (error) { return json({ error: "POST_DELETE_FAILED", detail: String(error), runtime }, { status: 500 }); }
  }

  return null;
}
