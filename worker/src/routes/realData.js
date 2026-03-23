import { fetchRows, getRequiredSupabaseEnv, mutateRows } from "../lib/supabase.js";
import { moodStickers, people } from "../mock/data.js";

function startOfMonth(monthText) {
  if (/^\d{4}-\d{2}$/.test(monthText || "")) return new Date(`${monthText}-01T00:00:00Z`);
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function shiftMonth(dateObj, diff) {
  return new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth() + diff, 1));
}

function formatMonth(dateObj) {
  return `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatDate(dateObj) {
  return `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, "0")}-${String(dateObj.getUTCDate()).padStart(2, "0")}`;
}

function currentDateInTimezone(timeZone = "Asia/Seoul") {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const map = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function nowIso() {
  return new Date().toISOString();
}

function buildPostSummary(content) {
  const cleaned = String(content || "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= 120) return cleaned;
  return `${cleaned.slice(0, 117)}...`;
}

function buildCalendar(monthStart, posts) {
  const firstDay = new Date(monthStart);
  const startWeekday = firstDay.getUTCDay();
  const gridStart = new Date(firstDay);
  gridStart.setUTCDate(firstDay.getUTCDate() - startWeekday);
  const weeks = [];
  for (let week = 0; week < 5; week += 1) {
    const row = [];
    for (let day = 0; day < 7; day += 1) {
      const cell = new Date(gridStart);
      cell.setUTCDate(gridStart.getUTCDate() + week * 7 + day);
      row.push({ date: formatDate(cell), day: cell.getUTCDate(), inMonth: cell.getUTCMonth() === monthStart.getUTCMonth() });
    }
    weeks.push(row);
  }
  const dateMap = {};
  for (const post of posts) {
    if (!dateMap[post.record_date]) dateMap[post.record_date] = [];
    dateMap[post.record_date].push({ id: post.id, owner: post.owner });
  }
  return { currentMonth: formatMonth(monthStart), prevMonth: formatMonth(shiftMonth(monthStart, -1)), nextMonth: formatMonth(shiftMonth(monthStart, 1)), weeks, dateMap };
}

function buildMoodPayload(rows) {
  const emojiMap = Object.fromEntries(moodStickers.map((item) => [item.id, item.emoji]));
  const latest = {};
  for (const row of rows) {
    if (latest[row.owner] || !emojiMap[row.mood_id]) continue;
    latest[row.owner] = { moodId: row.mood_id, emoji: emojiMap[row.mood_id] };
  }
  return { today: latest.you || null, latest, stickers: moodStickers };
}

function buildDdayPayload(row) {
  const title = row?.title || "우리의 D-day";
  const startDate = row?.start_date || formatDate(new Date());
  const targetDate = row?.target_date || formatDate(new Date());
  const today = new Date();
  const target = new Date(`${targetDate}T00:00:00Z`);
  const start = new Date(`${startDate}T00:00:00Z`);
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const diffDays = Math.floor((target - todayUtc) / 86400000);
  const label = diffDays > 0 ? `D-${diffDays}` : diffDays < 0 ? `D+${Math.abs(diffDays)}` : "D-DAY";
  const totalDays = Math.max(1, Math.floor((target - start) / 86400000));
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.floor((todayUtc - start) / 86400000)));
  const percent = Math.max(0, Math.min(100, Number(((elapsedDays / totalDays) * 100).toFixed(1))));
  return { title, startDate, targetDate, label, progress: { percent, text: `${percent.toFixed(1)}%` } };
}

function groupBy(items, key) {
  const out = {};
  for (const item of items) {
    const groupKey = String(item[key]);
    if (!out[groupKey]) out[groupKey] = [];
    out[groupKey].push(item);
  }
  return out;
}

function paginate(items, page = 1, perPage = 15) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePerPage = Math.max(1, Number(perPage) || 15);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePerPage));
  const clampedPage = Math.min(safePage, totalPages);
  const start = (clampedPage - 1) * safePerPage;
  return {
    items: items.slice(start, start + safePerPage),
    pagination: { page: clampedPage, perPage: safePerPage, totalPages, totalItems },
  };
}

function normalizeNotificationItem(item) {
  return {
    id: item.id,
    eventType: item.event_type,
    actor: item.actor,
    target: item.target,
    message: item.message,
    link: item.link,
    createdAt: item.created_at,
    seenAt: item.seen_at,
  };
}

function normalizePostItem(post, commentsMap, imagesMap, now = Date.now()) {
  return {
    id: post.id,
    owner: post.owner,
    content: post.content,
    summary: post.summary,
    recordDate: post.record_date,
    createdAt: post.created_at,
    isNew: now - new Date(post.created_at).getTime() < 86400000,
    images: (imagesMap[String(post.id)] || []).map((item) => item.image_path),
    comments: (commentsMap[String(post.id)] || []).map((item) => ({ id: item.id, author: item.author, content: item.content, createdAt: item.created_at })),
  };
}

async function fetchRelatedForPosts(env, posts) {
  const ids = posts.map((post) => post.id);
  let comments = [];
  let images = [];
  if (ids.length) {
    const idList = ids.join(",");
    const [commentsResult, imagesResult] = await Promise.all([
      fetchRows(env, "comments", { params: { select: "id,post_id,author,content,created_at", post_id: `in.(${idList})`, order: "id.asc" } }),
      fetchRows(env, "posts_images", { params: { select: "id,post_id,image_path,sort_order,created_at", post_id: `in.(${idList})`, order: "sort_order.asc,id.asc" } }),
    ]);
    comments = commentsResult.data || [];
    images = imagesResult.data || [];
  }
  return { commentsMap: groupBy(comments, "post_id"), imagesMap: groupBy(images, "post_id") };
}

async function fetchPostOwner(env, postId) {
  const result = await fetchRows(env, "posts", { params: { select: "id,owner", id: `eq.${Number(postId)}`, limit: 1 } });
  return result.data?.[0] || null;
}

async function fetchCommentById(env, commentId) {
  const result = await fetchRows(env, "comments", { params: { select: "id,post_id,author,content,created_at", id: `eq.${Number(commentId)}`, limit: 1 } });
  return result.data?.[0] || null;
}

async function fetchQuestionById(env, questionId) {
  const result = await fetchRows(env, "qna", { params: { select: "id,author,target,question,answer,answered_by,created_at,answered_at", id: `eq.${Number(questionId)}`, limit: 1 } });
  return result.data?.[0] || null;
}

export async function fetchHomeData(env, monthText) {
  getRequiredSupabaseEnv(env);
  const monthStart = startOfMonth(monthText);
  const monthEnd = shiftMonth(monthStart, 1);
  const fromDate = formatDate(monthStart);
  const toDate = formatDate(monthEnd);

  const [recentResult, ddayResult, moodResult, calendarPostsResult] = await Promise.all([
    fetchRows(env, "posts", { params: { select: "id,owner,summary,record_date,created_at", order: "id.desc", limit: 3 } }),
    fetchRows(env, "dday_settings", { params: { select: "title,start_date,target_date", id: "eq.1", limit: 1 } }),
    fetchRows(env, "mood_stickers", { params: { select: "owner,mood_id,record_date,created_at", order: "owner.asc,record_date.desc,created_at.desc", limit: 20 } }),
    fetchRows(env, "posts", { params: { select: "id,owner,record_date", order: "record_date.asc,id.asc", and: `(record_date.gte.${fromDate},record_date.lt.${toDate})`, limit: 100 } }),
  ]);

  return {
    dday: buildDdayPayload(ddayResult.data?.[0]),
    recentPosts: (recentResult.data || []).map((row) => ({ id: row.id, owner: row.owner, recordDate: row.record_date, createdAt: row.created_at, summary: row.summary })),
    mood: buildMoodPayload(moodResult.data || []),
    calendar: buildCalendar(monthStart, calendarPostsResult.data || []),
  };
}

export async function fetchPostsData(env, { page = 1, perPage = 6 } = {}) {
  getRequiredSupabaseEnv(env);
  const safePage = Math.max(1, Number(page) || 1);
  const safePerPage = Math.max(1, Math.min(20, Number(perPage) || 6));
  const from = (safePage - 1) * safePerPage;
  const postsResult = await fetchRows(env, "posts", { params: { select: "id,owner,content,summary,record_date,created_at", order: "id.desc", limit: safePerPage, offset: from }, headers: { Prefer: "count=exact" } });
  const posts = postsResult.data || [];
  const { commentsMap, imagesMap } = await fetchRelatedForPosts(env, posts);
  const totalItems = Number((postsResult.headers.get("content-range") || `0-0/${posts.length}`).split("/")[1] || posts.length);
  const totalPages = Math.max(1, Math.ceil(totalItems / safePerPage));
  const now = Date.now();
  return { items: posts.map((post) => normalizePostItem(post, commentsMap, imagesMap, now)), pagination: { page: safePage, perPage: safePerPage, totalPages, totalItems } };
}

export async function fetchPersonData(env, { owner = "you", page = 1, perPage = 15 } = {}) {
  getRequiredSupabaseEnv(env);
  const safePage = Math.max(1, Number(page) || 1);
  const safePerPage = Math.max(1, Math.min(30, Number(perPage) || 15));
  const from = (safePage - 1) * safePerPage;
  const postsResult = await fetchRows(env, "posts", { params: { select: "id,owner,content,summary,record_date,created_at", owner: `eq.${owner}`, order: "id.desc", limit: safePerPage, offset: from }, headers: { Prefer: "count=exact" } });
  const posts = postsResult.data || [];
  const { commentsMap, imagesMap } = await fetchRelatedForPosts(env, posts);
  const totalItems = Number((postsResult.headers.get("content-range") || `0-0/${posts.length}`).split("/")[1] || posts.length);
  const totalPages = Math.max(1, Math.ceil(totalItems / safePerPage));
  const now = Date.now();
  return { owner, ownerName: people[owner] || owner, isMyPage: owner === "you", posts: posts.map((post) => normalizePostItem(post, commentsMap, imagesMap, now)), pagination: { page: safePage, perPage: safePerPage, totalPages, totalItems } };
}

export async function fetchBucketData(env, { actor, ownerFilter = "all", statusFilter = "all", page = 1, perPage = 15 } = {}) {
  getRequiredSupabaseEnv(env);
  const result = await fetchRows(env, "bucket_items", { params: { select: "id,owner,content,is_done,created_at", order: "is_done.asc,id.desc", limit: 500 } });
  const items = (result.data || []).map((item) => ({ id: item.id, owner: item.owner, content: item.content, isDone: Boolean(item.is_done), createdAt: item.created_at }));
  const filtered = items.filter((item) => {
    const ownerOk = ownerFilter === "all" || (ownerFilter === "me" && item.owner === actor) || (ownerFilter === "partner" && item.owner !== actor);
    const statusOk = statusFilter === "all" || (statusFilter === "open" && !item.isDone) || (statusFilter === "done" && item.isDone);
    return ownerOk && statusOk;
  });
  const paged = paginate(filtered, page, perPage);
  return { items: paged.items, ownerFilter, statusFilter, pagination: paged.pagination };
}

export async function fetchQnaData(env, { actor, scopeFilter = "all", progressFilter = "all", page = 1, perPage = 15 } = {}) {
  getRequiredSupabaseEnv(env);
  const result = await fetchRows(env, "qna", { params: { select: "id,author,target,question,answer,answered_by,created_at,answered_at", order: "id.desc", limit: 500 } });
  const items = (result.data || []).map((item) => ({ id: item.id, author: item.author, target: item.target, question: item.question, answer: item.answer, answeredBy: item.answered_by, createdAt: item.created_at, answeredAt: item.answered_at }));
  const filtered = items.filter((item) => {
    const scopeOk = scopeFilter === "all" || (scopeFilter === "mine" && item.author === actor) || (scopeFilter === "for_me" && item.target === actor);
    const progressOk = progressFilter === "all" || (progressFilter === "answered" && Boolean(item.answer)) || (progressFilter === "pending" && !item.answer);
    return scopeOk && progressOk;
  });
  const paged = paginate(filtered, page, perPage);
  return { items: paged.items, scopeFilter, progressFilter, pagination: paged.pagination };
}

export async function fetchNotificationsData(env, { actor, limit = 100 } = {}) {
  getRequiredSupabaseEnv(env);
  const seenThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await mutateRows(env, "notifications", {
    method: "DELETE",
    params: { target: `eq.${actor}`, seen_at: `lt.${seenThreshold}` },
    headers: { Prefer: "return=minimal" },
  });
  await mutateRows(env, "notifications", {
    method: "PATCH",
    params: { target: `eq.${actor}`, seen_at: "is.null" },
    headers: { Prefer: "return=minimal" },
    body: { seen_at: nowIso() },
  });
  const result = await fetchRows(env, "notifications", {
    params: { select: "id,event_type,actor,target,message,link,created_at,seen_at", target: `eq.${actor}`, order: "id.desc", limit },
  });
  return { items: (result.data || []).map(normalizeNotificationItem) };
}

export async function exportBackupData(env) {
  getRequiredSupabaseEnv(env);
  const [postsResult, bucketResult, qnaResult, notificationResult, ddayResult] = await Promise.all([
    fetchRows(env, "posts", { params: { select: "id,owner,content,summary,record_date,created_at", order: "id.asc", limit: 2000 } }),
    fetchRows(env, "bucket_items", { params: { select: "id,owner,content,is_done,created_at", order: "id.asc", limit: 2000 } }),
    fetchRows(env, "qna", { params: { select: "id,author,target,question,answer,answered_by,created_at,answered_at", order: "id.asc", limit: 2000 } }),
    fetchRows(env, "notifications", { params: { select: "id,event_type,actor,target,message,link,created_at,seen_at", order: "id.asc", limit: 4000 } }),
    fetchRows(env, "dday_settings", { params: { select: "title,start_date,target_date", id: "eq.1", limit: 1 } }),
  ]);

  const posts = postsResult.data || [];
  const { commentsMap, imagesMap } = await fetchRelatedForPosts(env, posts);

  return {
    exported_at: nowIso(),
    site_title: "강구현지원",
    posts: posts.map((post) => ({
      id: post.id,
      owner: post.owner,
      content: post.content,
      summary: post.summary,
      record_date: post.record_date,
      created_at: post.created_at,
      images: (imagesMap[String(post.id)] || []).map((item) => item.image_path),
      comments: (commentsMap[String(post.id)] || []).map((item) => ({
        id: item.id,
        author: item.author,
        content: item.content,
        created_at: item.created_at,
      })),
    })),
    bucket_items: (bucketResult.data || []).map((item) => ({
      id: item.id,
      owner: item.owner,
      content: item.content,
      is_done: Boolean(item.is_done),
      created_at: item.created_at,
    })),
    questions: (qnaResult.data || []).map((item) => ({
      id: item.id,
      author: item.author,
      target: item.target,
      question: item.question,
      answer: item.answer,
      answered_by: item.answered_by,
      created_at: item.created_at,
      answered_at: item.answered_at,
    })),
    notifications: (notificationResult.data || []).map((item) => ({
      id: item.id,
      event_type: item.event_type,
      actor: item.actor,
      target: item.target,
      message: item.message,
      link: item.link,
      created_at: item.created_at,
      seen_at: item.seen_at,
    })),
    dday: ddayResult.data?.[0] || null,
  };
}

async function clearTable(env, table) {
  await mutateRows(env, table, {
    method: "DELETE",
    params: { id: "gt.0" },
    headers: { Prefer: "return=minimal" },
  });
}

export async function importBackupData(env, payload) {
  getRequiredSupabaseEnv(env);
  const posts = Array.isArray(payload?.posts) ? payload.posts : [];
  const bucketItems = Array.isArray(payload?.bucket_items) ? payload.bucket_items : [];
  const questions = Array.isArray(payload?.questions) ? payload.questions : [];
  const notifications = Array.isArray(payload?.notifications) ? payload.notifications : [];
  const dday = payload?.dday || null;

  await clearTable(env, "comments");
  await clearTable(env, "posts_images");
  await clearTable(env, "posts");
  await clearTable(env, "bucket_items");
  await clearTable(env, "qna");
  await clearTable(env, "notifications");
  await mutateRows(env, "dday_settings", {
    method: "DELETE",
    params: { id: "eq.1" },
    headers: { Prefer: "return=minimal" },
  });

  if (dday) {
    await mutateRows(env, "dday_settings", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: {
        id: 1,
        title: dday.title,
        start_date: dday.start_date,
        target_date: dday.target_date,
        updated_at: nowIso(),
      },
    });
  }

  if (posts.length) {
    await mutateRows(env, "posts", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: posts.map((post) => ({
        id: post.id,
        owner: post.owner,
        content: post.content,
        summary: post.summary || buildPostSummary(post.content),
        record_date: post.record_date,
        created_at: post.created_at || nowIso(),
      })),
    });

    const postImages = posts.flatMap((post) =>
      (post.images || []).map((imagePath, index) => ({
        post_id: post.id,
        image_path: imagePath,
        sort_order: index,
        created_at: post.created_at || nowIso(),
      }))
    );
    if (postImages.length) {
      await mutateRows(env, "posts_images", { method: "POST", headers: { Prefer: "return=representation" }, body: postImages });
    }

    const comments = posts.flatMap((post) =>
      (post.comments || []).map((comment) => ({
        id: comment.id,
        post_id: post.id,
        author: comment.author,
        content: comment.content,
        created_at: comment.created_at || nowIso(),
      }))
    );
    if (comments.length) {
      await mutateRows(env, "comments", { method: "POST", headers: { Prefer: "return=representation" }, body: comments });
    }
  }

  if (bucketItems.length) {
    await mutateRows(env, "bucket_items", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: bucketItems.map((item) => ({
        id: item.id,
        owner: item.owner,
        content: item.content,
        is_done: Boolean(item.is_done),
        created_at: item.created_at || nowIso(),
      })),
    });
  }

  if (questions.length) {
    await mutateRows(env, "qna", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: questions.map((item) => ({
        id: item.id,
        author: item.author,
        target: item.target,
        question: item.question,
        answer: item.answer,
        answered_by: item.answered_by,
        created_at: item.created_at || nowIso(),
        answered_at: item.answered_at,
      })),
    });
  }

  if (notifications.length) {
    await mutateRows(env, "notifications", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: notifications.map((item) => ({
        id: item.id,
        event_type: item.event_type,
        actor: item.actor,
        target: item.target,
        message: item.message,
        link: item.link,
        created_at: item.created_at || nowIso(),
        seen_at: item.seen_at,
      })),
    });
  }

  return { ok: true };
}

export async function saveMood(env, { owner = "you", moodId }) {
  getRequiredSupabaseEnv(env);
  if (!moodStickers.find((item) => item.id === moodId)) throw new Error("Invalid mood id");
  await mutateRows(env, "mood_stickers", { method: "POST", params: { on_conflict: "owner,record_date" }, headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: [{ owner, mood_id: moodId, record_date: currentDateInTimezone(env.DISPLAY_TIMEZONE || "Asia/Seoul"), created_at: nowIso() }] });
  return fetchHomeData(env, "");
}

export async function saveDday(env, { title, startDate, targetDate }) {
  getRequiredSupabaseEnv(env);
  if (!title || !startDate || !targetDate) throw new Error("Missing D-day fields");
  await mutateRows(env, "dday_settings", { method: "POST", params: { on_conflict: "id" }, headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: [{ id: 1, title, start_date: startDate, target_date: targetDate, updated_at: nowIso() }] });
  return fetchHomeData(env, "");
}

export async function saveComment(env, { postId, author = "you", content }) {
  getRequiredSupabaseEnv(env);
  const safePostId = Number(postId);
  const safeContent = String(content || "").trim();
  if (!safePostId || !safeContent) throw new Error("Missing comment fields");
  await mutateRows(env, "comments", { method: "POST", headers: { Prefer: "return=representation" }, body: { post_id: safePostId, author, content: safeContent, created_at: nowIso() } });
  return fetchPostsData(env, { page: 1, perPage: 6 });
}

export async function updateComment(env, { commentId, author = "you", content }) {
  getRequiredSupabaseEnv(env);
  const safeCommentId = Number(commentId);
  const safeContent = String(content || "").trim();
  if (!safeCommentId || !safeContent) throw new Error("Missing comment fields");
  const existing = await fetchCommentById(env, safeCommentId);
  if (!existing) throw new Error("Comment not found");
  if (existing.author !== author) throw new Error("No permission to edit this comment");
  await mutateRows(env, "comments", {
    method: "PATCH",
    params: { id: `eq.${safeCommentId}` },
    headers: { Prefer: "return=representation" },
    body: { content: safeContent },
  });
  return fetchPostsData(env, { page: 1, perPage: 6 });
}

export async function deleteCommentById(env, { commentId, author = "you" }) {
  getRequiredSupabaseEnv(env);
  const safeCommentId = Number(commentId);
  if (!safeCommentId) throw new Error("Invalid comment id");
  const existing = await fetchCommentById(env, safeCommentId);
  if (!existing) throw new Error("Comment not found");
  if (existing.author !== author) throw new Error("No permission to delete this comment");
  await mutateRows(env, "comments", {
    method: "DELETE",
    params: { id: `eq.${safeCommentId}` },
    headers: { Prefer: "return=minimal" },
  });
  return fetchPostsData(env, { page: 1, perPage: 6 });
}

export async function createPost(env, { owner = "you", content, recordDate, imageUrls = [] }) {
  getRequiredSupabaseEnv(env);
  const safeContent = String(content || "").trim();
  const safeRecordDate = String(recordDate || "").trim();
  if (!safeContent || !safeRecordDate) throw new Error("Missing post fields");
  const created = await mutateRows(env, "posts", { method: "POST", headers: { Prefer: "return=representation" }, body: { owner, content: safeContent, summary: buildPostSummary(safeContent), record_date: safeRecordDate, created_at: nowIso() } });
  const post = created.data?.[0];
  const safeImageUrls = imageUrls.filter(Boolean);
  if (post?.id && safeImageUrls.length) {
    await mutateRows(env, "posts_images", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: safeImageUrls.map((imagePath, index) => ({
        post_id: post.id,
        image_path: imagePath,
        sort_order: index,
        created_at: nowIso(),
      })),
    });
  }
  return fetchPersonData(env, { owner, page: 1, perPage: 15 });
}

export async function updatePost(env, { postId, owner = "you", content, recordDate }) {
  getRequiredSupabaseEnv(env);
  const safePostId = Number(postId);
  const safeContent = String(content || "").trim();
  const safeRecordDate = String(recordDate || "").trim();
  if (!safePostId || !safeContent || !safeRecordDate) throw new Error("Missing post fields");
  const existing = await fetchPostOwner(env, safePostId);
  if (!existing) throw new Error("Post not found");
  if (existing.owner !== owner) throw new Error("No permission to edit this post");
  await mutateRows(env, "posts", { method: "PATCH", params: { id: `eq.${safePostId}` }, headers: { Prefer: "return=representation" }, body: { content: safeContent, summary: buildPostSummary(safeContent), record_date: safeRecordDate } });
  return fetchPersonData(env, { owner, page: 1, perPage: 15 });
}

export async function deletePostById(env, { postId, owner = "you" }) {
  getRequiredSupabaseEnv(env);
  const safePostId = Number(postId);
  if (!safePostId) throw new Error("Invalid post id");
  const existing = await fetchPostOwner(env, safePostId);
  if (!existing) throw new Error("Post not found");
  if (existing.owner !== owner) throw new Error("No permission to delete this post");
  await mutateRows(env, "posts", { method: "DELETE", params: { id: `eq.${safePostId}` }, headers: { Prefer: "return=minimal" } });
  return fetchPersonData(env, { owner, page: 1, perPage: 15 });
}

export async function createBucketItem(env, { owner, content }) {
  getRequiredSupabaseEnv(env);
  const safeContent = String(content || "").trim();
  if (!safeContent) throw new Error("Missing bucket content");
  await mutateRows(env, "bucket_items", { method: "POST", headers: { Prefer: "return=representation" }, body: { owner, content: safeContent, created_at: nowIso() } });
  return fetchBucketData(env, { actor: owner });
}

export async function toggleBucketItemById(env, { itemId, actor }) {
  getRequiredSupabaseEnv(env);
  const result = await fetchRows(env, "bucket_items", { params: { select: "id,is_done", id: `eq.${Number(itemId)}`, limit: 1 } });
  const item = result.data?.[0];
  if (!item) throw new Error("Bucket item not found");
  await mutateRows(env, "bucket_items", { method: "PATCH", params: { id: `eq.${Number(itemId)}` }, headers: { Prefer: "return=representation" }, body: { is_done: !item.is_done } });
  return fetchBucketData(env, { actor });
}

export async function deleteBucketItemById(env, { itemId, actor }) {
  getRequiredSupabaseEnv(env);
  await mutateRows(env, "bucket_items", { method: "DELETE", params: { id: `eq.${Number(itemId)}` }, headers: { Prefer: "return=minimal" } });
  return fetchBucketData(env, { actor });
}

export async function createQuestion(env, { actor, question }) {
  getRequiredSupabaseEnv(env);
  const safeQuestion = String(question || "").trim();
  if (!safeQuestion) throw new Error("Missing question");
  const target = actor === "you" ? "partner" : "you";
  await mutateRows(env, "qna", { method: "POST", headers: { Prefer: "return=representation" }, body: { author: actor, target, question: safeQuestion, created_at: nowIso() } });
  return fetchQnaData(env, { actor });
}

export async function editQuestionById(env, { questionId, actor, question }) {
  getRequiredSupabaseEnv(env);
  const safeQuestion = String(question || "").trim();
  if (!safeQuestion) throw new Error("Missing question");
  const existing = await fetchQuestionById(env, questionId);
  if (!existing) throw new Error("Question not found");
  if (existing.author !== actor) throw new Error("No permission to edit this question");
  await mutateRows(env, "qna", { method: "PATCH", params: { id: `eq.${Number(questionId)}` }, headers: { Prefer: "return=representation" }, body: { question: safeQuestion } });
  return fetchQnaData(env, { actor });
}

export async function deleteQuestionById(env, { questionId, actor }) {
  getRequiredSupabaseEnv(env);
  const existing = await fetchQuestionById(env, questionId);
  if (!existing) throw new Error("Question not found");
  if (existing.author !== actor) throw new Error("No permission to delete this question");
  await mutateRows(env, "qna", { method: "DELETE", params: { id: `eq.${Number(questionId)}` }, headers: { Prefer: "return=minimal" } });
  return fetchQnaData(env, { actor });
}

export async function saveAnswerByQuestionId(env, { questionId, actor, answer }) {
  getRequiredSupabaseEnv(env);
  const safeAnswer = String(answer || "").trim();
  if (!safeAnswer) throw new Error("Missing answer");
  const existing = await fetchQuestionById(env, questionId);
  if (!existing) throw new Error("Question not found");
  if (existing.target !== actor && existing.answered_by !== actor) throw new Error("No permission to answer this question");
  await mutateRows(env, "qna", { method: "PATCH", params: { id: `eq.${Number(questionId)}` }, headers: { Prefer: "return=representation" }, body: { answer: safeAnswer, answered_by: actor, answered_at: nowIso() } });
  return fetchQnaData(env, { actor });
}

export async function clearAnswerByQuestionId(env, { questionId, actor }) {
  getRequiredSupabaseEnv(env);
  const existing = await fetchQuestionById(env, questionId);
  if (!existing) throw new Error("Question not found");
  if (existing.answered_by !== actor) throw new Error("No permission to delete this answer");
  await mutateRows(env, "qna", { method: "PATCH", params: { id: `eq.${Number(questionId)}` }, headers: { Prefer: "return=representation" }, body: { answer: null, answered_by: null, answered_at: null } });
  return fetchQnaData(env, { actor });
}
