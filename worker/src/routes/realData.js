import { fetchRows, getRequiredSupabaseEnv, mutateRows } from "../lib/supabase.js";
import { moodStickers } from "../mock/data.js";

function startOfMonth(monthText) {
  if (/^\d{4}-\d{2}$/.test(monthText || "")) {
    return new Date(`${monthText}-01T00:00:00Z`);
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function shiftMonth(dateObj, diff) {
  return new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth() + diff, 1));
}

function formatMonth(dateObj) {
  const y = dateObj.getUTCFullYear();
  const m = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatDate(dateObj) {
  const y = dateObj.getUTCFullYear();
  const m = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currentDateInTimezone(timeZone = "Asia/Seoul") {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function nowIso() {
  return new Date().toISOString();
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
      row.push({
        date: formatDate(cell),
        day: cell.getUTCDate(),
        inMonth: cell.getUTCMonth() === monthStart.getUTCMonth(),
      });
    }
    weeks.push(row);
  }

  const dateMap = {};
  for (const post of posts) {
    if (!dateMap[post.record_date]) dateMap[post.record_date] = [];
    dateMap[post.record_date].push({ id: post.id, owner: post.owner });
  }

  return {
    currentMonth: formatMonth(monthStart),
    prevMonth: formatMonth(shiftMonth(monthStart, -1)),
    nextMonth: formatMonth(shiftMonth(monthStart, 1)),
    weeks,
    dateMap,
  };
}

function buildMoodPayload(rows) {
  const emojiMap = Object.fromEntries(moodStickers.map((item) => [item.id, item.emoji]));
  const latest = {};
  for (const row of rows) {
    if (latest[row.owner]) continue;
    if (!emojiMap[row.mood_id]) continue;
    latest[row.owner] = { moodId: row.mood_id, emoji: emojiMap[row.mood_id] };
  }
  return {
    today: latest.you || null,
    latest,
    stickers: moodStickers,
  };
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
  return {
    title,
    startDate,
    targetDate,
    label,
    progress: {
      percent,
      text: `${percent.toFixed(1)}%`,
    },
  };
}

export async function fetchHomeData(env, monthText) {
  getRequiredSupabaseEnv(env);
  const monthStart = startOfMonth(monthText);
  const monthEnd = shiftMonth(monthStart, 1);
  const fromDate = formatDate(monthStart);
  const toDate = formatDate(monthEnd);

  const [recentResult, ddayResult, moodResult, calendarPostsResult] = await Promise.all([
    fetchRows(env, "posts", {
      params: {
        select: "id,owner,summary,record_date,created_at",
        order: "id.desc",
        limit: 3,
      },
    }),
    fetchRows(env, "dday_settings", {
      params: {
        select: "title,start_date,target_date",
        id: "eq.1",
        limit: 1,
      },
    }),
    fetchRows(env, "mood_stickers", {
      params: {
        select: "owner,mood_id,record_date,created_at",
        order: "owner.asc,record_date.desc,created_at.desc",
        limit: 20,
      },
    }),
    fetchRows(env, "posts", {
      params: {
        select: "id,owner,record_date",
        order: "record_date.asc,id.asc",
        and: `(record_date.gte.${fromDate},record_date.lt.${toDate})`,
        limit: 100,
      },
    }),
  ]);

  return {
    dday: buildDdayPayload(ddayResult.data?.[0]),
    recentPosts: (recentResult.data || []).map((row) => ({
      id: row.id,
      owner: row.owner,
      recordDate: row.record_date,
      createdAt: row.created_at,
      summary: row.summary,
    })),
    mood: buildMoodPayload(moodResult.data || []),
    calendar: buildCalendar(monthStart, calendarPostsResult.data || []),
  };
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

export async function fetchPostsData(env, { page = 1, perPage = 6 } = {}) {
  getRequiredSupabaseEnv(env);
  const safePage = Math.max(1, Number(page) || 1);
  const safePerPage = Math.max(1, Math.min(20, Number(perPage) || 6));
  const from = (safePage - 1) * safePerPage;

  const postsResult = await fetchRows(env, "posts", {
    params: {
      select: "id,owner,content,summary,record_date,created_at",
      order: "id.desc",
      limit: safePerPage,
      offset: from,
    },
    headers: {
      Prefer: "count=exact",
    },
  });

  const posts = postsResult.data || [];
  const ids = posts.map((post) => post.id);
  let comments = [];
  let images = [];

  if (ids.length) {
    const idList = ids.join(",");
    const [commentsResult, imagesResult] = await Promise.all([
      fetchRows(env, "comments", {
        params: {
          select: "id,post_id,author,content,created_at",
          post_id: `in.(${idList})`,
          order: "id.asc",
        },
      }),
      fetchRows(env, "posts_images", {
        params: {
          select: "id,post_id,image_path,sort_order,created_at",
          post_id: `in.(${idList})`,
          order: "sort_order.asc,id.asc",
        },
      }),
    ]);
    comments = commentsResult.data || [];
    images = imagesResult.data || [];
  }

  const commentsMap = groupBy(comments, "post_id");
  const imagesMap = groupBy(images, "post_id");
  const totalItems = Number((postsResult.headers.get("content-range") || `0-0/${ids.length}`).split("/")[1] || ids.length);
  const totalPages = Math.max(1, Math.ceil(totalItems / safePerPage));
  const now = Date.now();

  return {
    items: posts.map((post) => ({
      id: post.id,
      owner: post.owner,
      content: post.content,
      summary: post.summary,
      recordDate: post.record_date,
      createdAt: post.created_at,
      isNew: now - new Date(post.created_at).getTime() < 86400000,
      images: (imagesMap[String(post.id)] || []).map((item) => item.image_path),
      comments: (commentsMap[String(post.id)] || []).map((item) => ({
        id: item.id,
        author: item.author,
        content: item.content,
        createdAt: item.created_at,
      })),
    })),
    pagination: {
      page: safePage,
      perPage: safePerPage,
      totalPages,
      totalItems,
    },
  };
}

export async function saveMood(env, { owner = "you", moodId }) {
  getRequiredSupabaseEnv(env);
  if (!moodStickers.find((item) => item.id === moodId)) {
    throw new Error("Invalid mood id");
  }

  await mutateRows(env, "mood_stickers", {
    method: "POST",
    params: {
      on_conflict: "owner,record_date",
    },
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: [
      {
        owner,
        mood_id: moodId,
        record_date: currentDateInTimezone(env.DISPLAY_TIMEZONE || "Asia/Seoul"),
        created_at: nowIso(),
      },
    ],
  });

  return fetchHomeData(env, "");
}

export async function saveDday(env, { title, startDate, targetDate }) {
  getRequiredSupabaseEnv(env);
  if (!title || !startDate || !targetDate) {
    throw new Error("Missing D-day fields");
  }

  await mutateRows(env, "dday_settings", {
    method: "POST",
    params: {
      on_conflict: "id",
    },
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: [
      {
        id: 1,
        title,
        start_date: startDate,
        target_date: targetDate,
        updated_at: nowIso(),
      },
    ],
  });

  return fetchHomeData(env, "");
}

export async function saveComment(env, { postId, author = "you", content }) {
  getRequiredSupabaseEnv(env);
  const safePostId = Number(postId);
  const safeContent = String(content || "").trim();
  if (!safePostId || !safeContent) {
    throw new Error("Missing comment fields");
  }

  await mutateRows(env, "comments", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: {
      post_id: safePostId,
      author,
      content: safeContent,
      created_at: nowIso(),
    },
  });

  return fetchPostsData(env, { page: 1, perPage: 6 });
}

