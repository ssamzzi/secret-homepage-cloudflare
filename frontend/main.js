import { getJson, sendForm, sendJson } from "/src/api.js";

const state = {
  session: null,
  home: null,
  person: null,
  posts: null,
  bucket: null,
  qna: null,
  notifications: null,
};

const apiLog = document.getElementById("api-log");
const statusStrip = document.getElementById("status-strip");
const sessionChip = document.getElementById("session-chip");
const loginPanel = document.getElementById("login-panel");
const identityPanel = document.getElementById("identity-panel");
const appContent = document.getElementById("app-content");
let clocksStarted = false;
let statusTimer = null;
let currentHomeMonthKey = "";

function logApi(label, payload) {
  if (!apiLog) return;
  const serialized = JSON.stringify(payload, null, 2);
  const limited = serialized.length > 1200 ? `${serialized.slice(0, 1200)}\n... (truncated)` : serialized;
  apiLog.textContent = `${label}\n${limited}`;
}

async function loadJson(url) {
  const data = await getJson(url);
  logApi(`GET ${url}`, data);
  return data;
}

async function postJson(url, body) {
  const data = await sendJson(url, { method: "POST", body });
  logApi(`POST ${url}`, data);
  return data;
}

async function postForm(url, formData) {
  const data = await sendForm(url, formData, { method: "POST" });
  logApi(`POST ${url} [form]`, data);
  return data;
}

function showAppStage(stage) {
  loginPanel.hidden = stage !== "login";
  identityPanel.hidden = stage !== "identity";
  appContent.hidden = stage !== "app";
}

function setStatus(message, isError = false) {
  clearTimeout(statusTimer);
  statusStrip.hidden = !message;
  statusStrip.textContent = message;
  statusStrip.classList.toggle("error", Boolean(isError));
  if (message && !isError) {
    statusTimer = setTimeout(() => {
      statusStrip.hidden = true;
      statusStrip.textContent = "";
    }, 2200);
  }
}

function clearStatus() {
  clearTimeout(statusTimer);
  statusStrip.hidden = true;
  statusStrip.textContent = "";
  statusStrip.classList.remove("error");
}

function renderClock(targetId, tz) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.textContent = new Intl.DateTimeFormat("ko-KR", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function currentMonthKeyInTimezone(timeZone = "Asia/Seoul") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}`;
}

function startClocks() {
  if (clocksStarted) return;
  clocksStarted = true;
  const tick = async () => {
    renderClock("clock-seoul", "Asia/Seoul");
    renderClock("clock-asuncion", "America/Asuncion");
    const latestMonthKey = currentMonthKeyInTimezone("Asia/Seoul");
    if (state.session?.authenticated && state.session?.currentUser && state.home && currentHomeMonthKey && currentHomeMonthKey !== latestMonthKey) {
      currentHomeMonthKey = latestMonthKey;
      try {
        state.home = await loadJson("/api/v1/home");
        renderHome();
      } catch (error) {
        setStatus(`달력 갱신 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      }
    }
  };
  tick();
  setInterval(tick, 1000);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function currentPersonLabel(userKey) {
  return state.session?.people?.[userKey] || userKey;
}

function activateTab(targetId) {
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
  document.querySelector(`[data-tab-target="${targetId}"]`)?.classList.add("active");
  document.getElementById(targetId)?.classList.add("active");
}

async function loadBoardPage(page = 1) {
  state.posts = await loadJson(`/api/v1/posts?page=${page}&perPage=6`);
  renderBoard();
}

async function loadPersonPage(page = 1) {
  state.person = await loadJson(`/api/v1/person/${state.session.currentUser}?page=${page}&perPage=6`);
  renderPerson();
}

async function loadBucketPage(page = 1) {
  const owner = document.getElementById("bucket-owner-filter")?.value || state.bucket?.ownerFilter || "all";
  const status = document.getElementById("bucket-status-filter")?.value || state.bucket?.statusFilter || "all";
  state.bucket = await loadJson(`/api/v1/bucket?owner=${owner}&status=${status}&page=${page}&perPage=6`);
  renderBucket();
}

async function loadQnaPage(page = 1) {
  const scope = document.getElementById("qna-scope-filter")?.value || state.qna?.scopeFilter || "all";
  const progress = document.getElementById("qna-progress-filter")?.value || state.qna?.progressFilter || "all";
  state.qna = await loadJson(`/api/v1/qna?scope=${scope}&progress=${progress}&page=${page}&perPage=6`);
  renderQna();
}

async function goToBoardPost(postId) {
  const pageInfo = await loadJson(`/api/v1/posts/${postId}/page?perPage=6`);
  await loadBoardPage(pageInfo.page || 1);
  activateTab("board-panel");
  requestAnimationFrame(() => {
    document.getElementById(`post-${postId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function formatShortDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function resolveNotificationTarget(link) {
  if (!link) return null;
  if (link.includes("qna")) return { tab: "qna-panel" };
  if (link.includes("bucket")) return { tab: "bucket-panel" };
  if (link.includes("notifications")) return { tab: "notifications-panel" };
  const postMatch = link.match(/post-(\d+)/);
  if (postMatch) return { tab: "board-panel", postId: Number(postMatch[1]) };
  if (link.includes("board")) return { tab: "board-panel" };
  if (link.includes("person")) return { tab: "person-panel" };
  return null;
}

function renderSession() {
  if (!state.session) return;
  const { currentUser, people, authenticated } = state.session;

  if (!authenticated) {
    showAppStage("login");
    clearStatus();
    return;
  }

  if (!currentUser) {
    showAppStage("identity");
    clearStatus();
    return;
  }

  showAppStage("app");
  sessionChip.textContent = people[currentUser];
  clearStatus();
}

function renderHome() {
  if (!state.home || !state.session) return;
  const { dday, recentPosts, mood, calendar } = state.home;
  const { currentUser, people } = state.session;

  document.getElementById("dday-label").textContent = dday.label;
  document.getElementById("dday-title").textContent = dday.title;
  document.getElementById("dday-progress-text").textContent = dday.progress.text;
  document.getElementById("dday-progress-bar").style.width = `${dday.progress.percent}%`;
  document.getElementById("dday-form-title").value = dday.title || "";
  document.getElementById("dday-form-start").value = dday.startDate || "";
  document.getElementById("dday-form-target").value = dday.targetDate || "";

  document.getElementById("mood-strip").innerHTML = Object.entries(mood.latest)
    .map(([key, value]) => `<div class="mood-pill ${key === currentUser ? "mine" : ""}"><strong>${escapeHtml(people[key])}</strong><span class="mood-emoji-large">${escapeHtml(value.emoji)}</span></div>`)
    .join("");

  document.getElementById("mood-picker").innerHTML = mood.stickers
    .map((item) => `<button class="emoji-btn ${item.id === mood.today?.moodId ? "active" : ""}" type="button" data-mood-id="${escapeHtml(item.id)}" title="${escapeHtml(item.label)}">${escapeHtml(item.emoji)}</button>`)
    .join("");

  document.getElementById("recent-list").innerHTML = recentPosts
    .map((post) => `<article class="recent-item"><a class="recent-link" href="#" data-post-jump="${post.id}"><div class="row-between"><strong>${escapeHtml(people[post.owner])}</strong><span class="muted small">${escapeHtml(post.recordDate)}</span></div><p>${escapeHtml(post.summary || "요약 없음")}</p></a></article>`)
    .join("");

  document.getElementById("calendar-title").textContent = `${calendar.currentMonth} 달력`;
  currentHomeMonthKey = calendar.currentMonth;
  const weekNames = ["일", "월", "화", "수", "목", "금", "토"];
  document.getElementById("calendar-grid").innerHTML = weekNames.map((day) => `<div class="week-header">${day}</div>`).join("") + calendar.weeks.flat().map((cell) => {
    const posts = calendar.dateMap[cell.date] || [];
    return `<div class="day-cell ${cell.inMonth ? "" : "dim"}"><p class="day-number">${cell.day}</p>${posts.map((post) => `<a href="#" class="mini-post" data-post-jump="${post.id}">${escapeHtml(people[post.owner])}</a>`).join("")}</div>`;
  }).join("");

  bindMoodButtons();
  bindDdayForm();
  bindPostJumpLinks();
}

function renderPerson() {
  if (!state.person) return;
  const { ownerName, posts, pagination } = state.person;
  document.getElementById("person-title").textContent = `${ownerName}의 하루`;
  const recordDateInput = document.getElementById("person-record-date");
  if (recordDateInput && !recordDateInput.value) recordDateInput.value = new Date().toISOString().slice(0, 10);

  document.getElementById("person-posts").innerHTML = posts.length
    ? posts.map((post) => `<article class="card person-post-card"><div class="row-between section-head compact"><strong>${escapeHtml(ownerName)} ${post.isNew ? '<span class="new-badge">NEW</span>' : ""}</strong><span class="muted small">${escapeHtml(post.recordDate)}</span></div>${post.images.length ? `<div class="image-stack">${post.images.map((src) => `<img src="${escapeHtml(src)}" alt="게시물 이미지" loading="lazy" />`).join("")}</div>` : ""}<p class="post-content">${escapeHtml(post.content)}</p><details class="editor-box person-edit-box"><summary>조금 고치기</summary><form class="stack-form post-edit-form" data-post-id="${post.id}"><label><span>기록 날짜</span><input type="date" name="recordDate" value="${escapeHtml(post.recordDate)}" required /></label><label><span>내용</span><textarea name="content" rows="4" required>${escapeHtml(post.content)}</textarea></label><button type="submit">수정 저장</button></form></details><div class="post-actions"><button type="button" class="danger-btn" data-delete-post-id="${post.id}">삭제</button></div></article>`).join("")
    : '<article class="card"><p>아직 기록이 없어요.</p></article>';

  document.getElementById("person-pagination").innerHTML = renderPagination(pagination, "person-prev", "person-next");
  bindPersonCreateForm();
  bindPostEditForms();
  bindPostDeleteButtons();
  bindPersonPagination();
}

function renderComment(comment) {
  const canManage = comment.author === state.session.currentUser;
  return `<article class="comment-item"><div class="comment-line"><strong>${escapeHtml(currentPersonLabel(comment.author))}</strong><span class="comment-body">${escapeHtml(comment.content)}</span></div>${canManage ? `<div class="comment-tools"><button type="button" class="tiny-link-btn" data-comment-edit-toggle="${comment.id}">수정</button><button type="button" class="tiny-link-btn danger-link" data-comment-delete-id="${comment.id}">삭제</button></div><form class="comment-edit-form" data-comment-id="${comment.id}" hidden><textarea name="content" rows="2" required>${escapeHtml(comment.content)}</textarea><div class="inline-actions"><button type="submit" class="small-btn">저장</button><button type="button" class="tiny-link-btn" data-comment-edit-cancel="${comment.id}">취소</button></div></form>` : ""}</article>`;
}

function renderBoard() {
  if (!state.posts) return;
  const { items } = state.posts;
  document.getElementById("board-grid").innerHTML = items.map((post) => `<article class="card post-card" id="post-${post.id}"><div class="row-between section-head compact"><strong>${escapeHtml(currentPersonLabel(post.owner))} ${post.isNew ? '<span class="new-badge">NEW</span>' : ""}</strong><span class="muted small">${escapeHtml(post.recordDate)}</span></div>${post.images.length ? `<div class="image-stack">${post.images.map((src) => `<img src="${escapeHtml(src)}" alt="게시물 이미지" loading="lazy" />`).join("")}</div>` : ""}<div class="note"><p>${escapeHtml(post.content)}</p></div><section class="comments-box"><h3>댓글</h3><div class="comment-list">${post.comments.length ? post.comments.map(renderComment).join("") : '<p class="muted small">첫 마음을 남겨볼까요?</p>'}</div><form class="comment-form" data-post-id="${post.id}"><textarea name="content" rows="3" placeholder="짧게 댓글 남기기"></textarea><button type="submit">한마디 보내기</button></form></section></article>`).join("");
  document.getElementById("board-pagination").innerHTML = renderPagination(state.posts.pagination, "board-prev", "board-next");
  bindCommentForms();
  bindCommentTools();
  bindBoardPagination();
}
function renderBucket() {
  if (!state.bucket) return;
  const { people } = state.session;
  document.getElementById("bucket-owner-filter").value = state.bucket.ownerFilter || "all";
  document.getElementById("bucket-status-filter").value = state.bucket.statusFilter || "all";
  document.getElementById("bucket-items").innerHTML = state.bucket.items.length
    ? state.bucket.items.map((item) => `<article class="card bucket-card ${item.isDone ? "done" : ""}"><div class="row-between"><p class="bucket-owner">${escapeHtml(people[item.owner])}</p>${item.isDone ? '<span class="done-badge">완료</span>' : ""}</div><p class="bucket-text">${escapeHtml(item.content)}</p><div class="action-row"><button type="button" class="small-btn" data-bucket-toggle-id="${item.id}">${item.isDone ? "미완료로" : "완료"}</button><button type="button" class="danger-btn small-btn" data-bucket-delete-id="${item.id}">삭제</button></div></article>`).join("")
    : '<article class="card"><p>아직 버킷리스트가 없어요.</p></article>';

  document.getElementById("bucket-pagination").innerHTML = renderPagination(state.bucket.pagination, "bucket-prev", "bucket-next");
  bindBucketForm();
  bindBucketActions();
  bindBucketFilters();
  bindBucketPagination();
}

function renderQna() {
  if (!state.qna) return;
  const { currentUser, people } = state.session;
  document.getElementById("qna-scope-filter").value = state.qna.scopeFilter || "all";
  document.getElementById("qna-progress-filter").value = state.qna.progressFilter || "all";
  document.getElementById("qna-items").innerHTML = state.qna.items.length
    ? state.qna.items.map((item) => {
      const canEditQuestion = item.author === currentUser;
      const canAnswer = item.target === currentUser || item.answeredBy === currentUser;
      return `<article class="card qna-card"><p><strong>${escapeHtml(people[item.author])}</strong> → <strong>${escapeHtml(people[item.target])}</strong></p><p class="qna-question">Q. ${escapeHtml(item.question)}</p>${canEditQuestion ? `<div class="qna-meta-row"><details class="editor-box"><summary>질문 수정</summary><form class="stack-form qna-edit-form" data-question-id="${item.id}"><textarea name="question" rows="2" required>${escapeHtml(item.question)}</textarea><button type="submit">수정 저장</button></form></details><button type="button" class="tiny-link-btn danger-link" data-qna-delete-id="${item.id}">질문 삭제</button></div>` : ""}${item.answer ? `<p class="qna-answer">A. ${escapeHtml(item.answer)}</p>${canAnswer ? `<div class="qna-meta-row"><details class="editor-box"><summary>답변 수정</summary><form class="stack-form qna-answer-form" data-question-id="${item.id}"><textarea name="answer" rows="2" required>${escapeHtml(item.answer)}</textarea><button type="submit">답변 저장</button></form></details><button type="button" class="tiny-link-btn danger-link" data-answer-delete-id="${item.id}">답변 삭제</button></div>` : ""}` : `${item.target === currentUser ? `<form class="stack-form qna-answer-form" data-question-id="${item.id}"><textarea name="answer" rows="2" placeholder="답변을 적어주세요" required></textarea><button type="submit">답변 등록</button></form>` : '<p class="muted small">천천히 답이 오고 있어요...</p>'}`}</article>`;
    }).join("")
    : '<article class="card"><p>아직 질문이 없어요.</p></article>';

  document.getElementById("qna-pagination").innerHTML = renderPagination(state.qna.pagination, "qna-prev", "qna-next");
  bindQnaForm();
  bindQnaActions();
  bindQnaFilters();
  bindQnaPagination();
}

function renderNotifications() {
  if (!state.notifications) return;
  const container = document.getElementById("notifications-list");
  container.innerHTML = state.notifications.items.length
    ? state.notifications.items
        .map(
          (item) => `
            <article class="card notification-card">
              <div class="row-between section-head compact">
                <strong>${escapeHtml(item.message)}</strong>
                <span class="muted small">${escapeHtml(formatShortDateTime(item.createdAt || ""))}</span>
              </div>
              <p class="muted small">${escapeHtml(currentPersonLabel(item.actor))} → ${escapeHtml(currentPersonLabel(item.target))}</p>
              ${item.link ? `<button type="button" class="tiny-link-btn" data-notification-link="${escapeHtml(item.link)}">보러 가기</button>` : ""}
            </article>
          `
        )
        .join("")
    : '<article class="card"><p>아직 도착한 소식이 없어요.</p></article>';
  bindNotificationLinks();
}

function renderPagination(pagination, prevId, nextId) {
  if (!pagination || pagination.totalPages <= 1) return "";
  return `
    <button type="button" class="small-btn" id="${prevId}" ${pagination.page <= 1 ? "disabled" : ""}>이전</button>
    <span class="page-indicator">${pagination.page} / ${pagination.totalPages}</span>
    <button type="button" class="small-btn" id="${nextId}" ${pagination.page >= pagination.totalPages ? "disabled" : ""}>다음</button>
  `;
}

function bindTabs() {
  document.querySelectorAll("[data-tab-target]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(button.dataset.tabTarget)?.classList.add("active");
    });
  });
}

function bindHomeTitleButton() {
  const button = document.getElementById("home-title-btn");
  if (!button || button.dataset.bound === "true") return;
  button.dataset.bound = "true";
  button.addEventListener("click", () => {
    activateTab("home-panel");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function bindLoginForm() {
  const form = document.getElementById("login-form");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const submitButton = form.querySelector("button[type='submit']");
    try {
      if (submitButton) submitButton.disabled = true;
      setStatus("비밀번호 확인 중...");
      state.session = (await postJson("/api/v1/login", { password: String(formData.get("password") || "") })).session;
      form.reset();
      renderSession();
    } catch (error) {
      setStatus(`로그인 실패: ${error instanceof Error ? error.message : String(error)}`, true);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

function bindIdentityButtons() {
  document.querySelectorAll("[data-identity]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      try {
        button.disabled = true;
        setStatus("사용자 선택 중...");
        state.session = (await postJson("/api/v1/whoami", { currentUser: button.dataset.identity })).session;
        renderSession();
        await loadAppData();
      } catch (error) {
        setStatus(`사용자 선택 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      } finally {
        button.disabled = false;
      }
    });
  });
}

function bindLogoutButton() {
  const button = document.getElementById("logout-btn");
  if (!button || button.dataset.bound === "true") return;
  button.dataset.bound = "true";
  button.addEventListener("click", async () => {
    try {
      button.disabled = true;
      await postJson("/api/v1/logout", {});
      state.session = await loadJson("/api/v1/session");
      state.home = null;
      state.person = null;
      state.posts = null;
      state.bucket = null;
      state.qna = null;
      state.notifications = null;
      renderSession();
    } catch (error) {
      setStatus(`로그아웃 실패: ${error instanceof Error ? error.message : String(error)}`, true);
    } finally {
      button.disabled = false;
    }
  });
}

function bindMoodButtons() {
  document.querySelectorAll("[data-mood-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        button.disabled = true;
        setStatus("기분 스티커 저장 중...");
        state.home = (await postJson("/api/v1/moods", { moodId: button.dataset.moodId })).home;
        renderHome();
        setStatus("오늘의 기분 스티커를 저장했습니다.");
      } catch (error) {
        setStatus(`기분 스티커 저장 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      } finally {
        button.disabled = false;
      }
    }, { once: true });
  });
}

function bindDdayForm() {
  const form = document.getElementById("dday-form");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const submitButton = form.querySelector("button[type='submit']");
    try {
      if (submitButton) submitButton.disabled = true;
      setStatus("D-day 저장 중...");
      state.home = (await postJson("/api/v1/dday", { title: String(formData.get("title") || "").trim(), startDate: String(formData.get("startDate") || ""), targetDate: String(formData.get("targetDate") || "") })).home;
      renderHome();
      document.getElementById("dday-editor")?.removeAttribute("open");
      setStatus("우리의 날짜를 다시 맞춰뒀어요.");
    } catch (error) {
      setStatus(`D-day 저장 실패: ${error instanceof Error ? error.message : String(error)}`, true);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}
function bindPersonCreateForm() {
  const form = document.getElementById("person-post-form");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector("button[type='submit']");
    const filesInput = document.getElementById("person-images");
    try {
      if (submitButton) submitButton.disabled = true;
      setStatus("기록 저장 중...");
      const formData = new FormData(form);
      await postForm(`/api/v1/person/${state.session.currentUser}/posts`, formData);
      await loadPersonPage(1);
      await loadBoardPage(1);
      form.reset();
      if (filesInput) filesInput.value = "";
      document.getElementById("person-record-date").value = new Date().toISOString().slice(0, 10);
      setStatus("오늘의 하루를 잘 담아뒀어요.");
    } catch (error) {
      setStatus(`기록 저장 실패: ${error instanceof Error ? error.message : String(error)}`, true);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

function bindPostEditForms() {
  document.querySelectorAll(".post-edit-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = form.querySelector("button[type='submit']");
      const formData = new FormData(form);
      try {
        if (submitButton) submitButton.disabled = true;
        setStatus("글 수정 중...");
        await postJson(`/api/v1/posts/${form.dataset.postId}/edit`, { recordDate: String(formData.get("recordDate") || ""), content: String(formData.get("content") || "").trim() });
        await loadPersonPage(state.person?.pagination?.page || 1);
        await loadBoardPage(state.posts?.pagination?.page || 1);
        setStatus("기록을 조금 더 예쁘게 고쳐뒀어요.");
      } catch (error) {
        setStatus(`글 수정 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  });
}

function bindPostDeleteButtons() {
  document.querySelectorAll("[data-delete-post-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("이 기록을 삭제할까요?")) return;
      try {
        button.disabled = true;
        setStatus("글 삭제 중...");
        await postJson(`/api/v1/posts/${button.dataset.deletePostId}/delete`, {});
        await loadPersonPage(state.person?.pagination?.page || 1);
        await loadBoardPage(state.posts?.pagination?.page || 1);
        setStatus("글을 삭제했습니다.");
      } catch (error) {
        setStatus(`글 삭제 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      } finally {
        button.disabled = false;
      }
    });
  });
}

function bindCommentForms() {
  document.querySelectorAll(".comment-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const textarea = form.querySelector("textarea[name='content']");
      const submitButton = form.querySelector("button[type='submit']");
      const content = String(textarea?.value || "").trim();
      if (!content) return;
      try {
        if (submitButton) submitButton.disabled = true;
        setStatus("댓글 저장 중...");
        await postJson(`/api/v1/posts/${form.dataset.postId}/comments`, { content });
        await loadBoardPage(state.posts?.pagination?.page || 1);
        setStatus("한마디가 잘 전해졌어요.");
      } catch (error) {
        setStatus(`댓글 저장 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  });
}

function bindCommentTools() {
  document.querySelectorAll("[data-comment-edit-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const form = document.querySelector(`.comment-edit-form[data-comment-id="${button.dataset.commentEditToggle}"]`);
      if (form) form.hidden = false;
    });
  });

  document.querySelectorAll("[data-comment-edit-cancel]").forEach((button) => {
    button.addEventListener("click", () => {
      const form = document.querySelector(`.comment-edit-form[data-comment-id="${button.dataset.commentEditCancel}"]`);
      if (form) form.hidden = true;
    });
  });

  document.querySelectorAll(".comment-edit-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = form.querySelector("button[type='submit']");
      const formData = new FormData(form);
      try {
        if (submitButton) submitButton.disabled = true;
        setStatus("댓글 수정 중...");
        await postJson(`/api/v1/comments/${form.dataset.commentId}/edit`, { content: String(formData.get("content") || "").trim() });
        await loadBoardPage(state.posts?.pagination?.page || 1);
        setStatus("댓글을 수정했습니다.");
      } catch (error) {
        setStatus(`댓글 수정 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-comment-delete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("이 댓글을 삭제할까요?")) return;
      try {
        button.disabled = true;
        setStatus("댓글 삭제 중...");
        await postJson(`/api/v1/comments/${button.dataset.commentDeleteId}/delete`, {});
        await loadBoardPage(state.posts?.pagination?.page || 1);
        setStatus("댓글을 삭제했습니다.");
      } catch (error) {
        setStatus(`댓글 삭제 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      } finally {
        button.disabled = false;
      }
    });
  });
}

function bindBucketForm() {
  const form = document.getElementById("bucket-form");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const submitButton = form.querySelector("button[type='submit']");
    try {
      if (submitButton) submitButton.disabled = true;
      setStatus("버킷리스트 저장 중...");
      await postJson("/api/v1/bucket", { content: String(formData.get("content") || "").trim() });
      await loadBucketPage(1);
      form.reset();
      setStatus("함께 하고 싶은 일을 붙여뒀어요.");
    } catch (error) {
      setStatus(`버킷리스트 저장 실패: ${error instanceof Error ? error.message : String(error)}`, true);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

function bindBucketActions() {
  document.querySelectorAll("[data-bucket-toggle-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        button.disabled = true;
        await postJson(`/api/v1/bucket/${button.dataset.bucketToggleId}/toggle`, {});
        await loadBucketPage(state.bucket?.pagination?.page || 1);
        setStatus("버킷 상태를 바꿨습니다.");
      } catch (error) {
        setStatus(`버킷 변경 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-bucket-delete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("이 버킷을 삭제할까요?")) return;
      try {
        button.disabled = true;
        await postJson(`/api/v1/bucket/${button.dataset.bucketDeleteId}/delete`, {});
        await loadBucketPage(state.bucket?.pagination?.page || 1);
        setStatus("버킷을 삭제했습니다.");
      } catch (error) {
        setStatus(`버킷 삭제 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      } finally {
        button.disabled = false;
      }
    });
  });
}

function bindBucketFilters() {
  const owner = document.getElementById("bucket-owner-filter");
  const status = document.getElementById("bucket-status-filter");
  [owner, status].forEach((element) => {
    if (!element || element.dataset.bound === "true") return;
    element.dataset.bound = "true";
    element.addEventListener("change", async () => {
      try {
        await loadBucketPage(1);
      } catch (error) {
        setStatus(`버킷 불러오기 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      }
    });
  });
}
function bindQnaForm() {
  const form = document.getElementById("qna-form");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const submitButton = form.querySelector("button[type='submit']");
    try {
      if (submitButton) submitButton.disabled = true;
      setStatus("질문 저장 중...");
      await postJson("/api/v1/qna", { question: String(formData.get("question") || "").trim() });
      await loadQnaPage(1);
      form.reset();
      setStatus("궁금한 마음을 살짝 남겨뒀어요.");
    } catch (error) {
      setStatus(`질문 저장 실패: ${error instanceof Error ? error.message : String(error)}`, true);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

function bindQnaActions() {
  document.querySelectorAll(".qna-edit-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = form.querySelector("button[type='submit']");
      const formData = new FormData(form);
      try {
        if (submitButton) submitButton.disabled = true;
        await postJson(`/api/v1/qna/${form.dataset.questionId}/edit`, { question: String(formData.get("question") || "").trim() });
        await loadQnaPage(state.qna?.pagination?.page || 1);
        setStatus("질문을 수정했습니다.");
      } catch (error) {
        setStatus(`질문 수정 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  });

  document.querySelectorAll(".qna-answer-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = form.querySelector("button[type='submit']");
      const formData = new FormData(form);
      try {
        if (submitButton) submitButton.disabled = true;
        await postJson(`/api/v1/qna/${form.dataset.questionId}/answer`, { answer: String(formData.get("answer") || "").trim() });
        await loadQnaPage(state.qna?.pagination?.page || 1);
        setStatus("답변을 저장했습니다.");
      } catch (error) {
        setStatus(`답변 저장 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-qna-delete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("이 질문을 삭제할까요?")) return;
      try {
        button.disabled = true;
        await postJson(`/api/v1/qna/${button.dataset.qnaDeleteId}/delete`, {});
        await loadQnaPage(state.qna?.pagination?.page || 1);
        setStatus("질문을 삭제했습니다.");
      } catch (error) {
        setStatus(`질문 삭제 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-answer-delete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("이 답변을 삭제할까요?")) return;
      try {
        button.disabled = true;
        await postJson(`/api/v1/qna/${button.dataset.answerDeleteId}/answer/delete`, {});
        await loadQnaPage(state.qna?.pagination?.page || 1);
        setStatus("답변을 삭제했습니다.");
      } catch (error) {
        setStatus(`답변 삭제 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      } finally {
        button.disabled = false;
      }
    });
  });
}

function bindQnaFilters() {
  const scope = document.getElementById("qna-scope-filter");
  const progress = document.getElementById("qna-progress-filter");
  [scope, progress].forEach((element) => {
    if (!element || element.dataset.bound === "true") return;
    element.dataset.bound = "true";
    element.addEventListener("change", async () => {
      try {
        await loadQnaPage(1);
      } catch (error) {
        setStatus(`질문 불러오기 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      }
    });
  });
}

function bindBackupImportForm() {
  const form = document.getElementById("backup-import-form");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!confirm("백업을 복원하면 현재 데이터가 교체됩니다. 계속할까요?")) return;
    const submitButton = form.querySelector("button[type='submit']");
    try {
      if (submitButton) submitButton.disabled = true;
      setStatus("백업 복원 중...");
      const formData = new FormData(form);
      await postForm("/api/v1/backup/import", formData);
      await loadAppData();
      setStatus("백업 복원을 완료했습니다.");
      form.reset();
    } catch (error) {
      setStatus(`백업 복원 실패: ${error instanceof Error ? error.message : String(error)}`, true);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

function bindPostJumpLinks() {
  document.querySelectorAll("[data-post-jump]").forEach((element) => {
    if (element.dataset.bound === "true") return;
    element.dataset.bound = "true";
    element.addEventListener("click", async (event) => {
      event.preventDefault();
      await goToBoardPost(Number(element.dataset.postJump));
    });
  });
}

function bindNotificationLinks() {
  document.querySelectorAll("[data-notification-link]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const target = resolveNotificationTarget(button.dataset.notificationLink);
      if (!target) return;
      if (target.postId) {
        await goToBoardPost(target.postId);
        return;
      }
      activateTab(target.tab);
      if (target.tab === "person-panel") {
        await loadPersonPage(1);
      }
      if (target.tab === "board-panel") {
        await loadBoardPage(1);
      }
    });
  });
}

function bindPersonPagination() {
  document.getElementById("person-prev")?.addEventListener("click", async () => {
    await loadPersonPage((state.person?.pagination?.page || 1) - 1);
  }, { once: true });
  document.getElementById("person-next")?.addEventListener("click", async () => {
    await loadPersonPage((state.person?.pagination?.page || 1) + 1);
  }, { once: true });
}

function bindBoardPagination() {
  document.getElementById("board-prev")?.addEventListener("click", async () => {
    await loadBoardPage((state.posts?.pagination?.page || 1) - 1);
  }, { once: true });
  document.getElementById("board-next")?.addEventListener("click", async () => {
    await loadBoardPage((state.posts?.pagination?.page || 1) + 1);
  }, { once: true });
}

function bindBucketPagination() {
  document.getElementById("bucket-prev")?.addEventListener("click", async () => {
    await loadBucketPage((state.bucket?.pagination?.page || 1) - 1);
  }, { once: true });
  document.getElementById("bucket-next")?.addEventListener("click", async () => {
    await loadBucketPage((state.bucket?.pagination?.page || 1) + 1);
  }, { once: true });
}

function bindQnaPagination() {
  document.getElementById("qna-prev")?.addEventListener("click", async () => {
    await loadQnaPage((state.qna?.pagination?.page || 1) - 1);
  }, { once: true });
  document.getElementById("qna-next")?.addEventListener("click", async () => {
    await loadQnaPage((state.qna?.pagination?.page || 1) + 1);
  }, { once: true });
}

async function loadAppData() {
  const [home, person, posts, bucket, qna, notifications] = await Promise.all([
    loadJson("/api/v1/home"),
    loadJson(`/api/v1/person/${state.session.currentUser}?page=1&perPage=6`),
    loadJson("/api/v1/posts?page=1&perPage=6"),
    loadJson("/api/v1/bucket?page=1&perPage=6"),
    loadJson("/api/v1/qna?page=1&perPage=6"),
    loadJson("/api/v1/notifications"),
  ]);
  state.home = home;
  state.person = person;
  state.posts = posts;
  state.bucket = bucket;
  state.qna = qna;
  state.notifications = notifications;
  renderHome();
  renderPerson();
  renderBoard();
  renderBucket();
  renderQna();
  renderNotifications();
  bindBackupImportForm();
}

async function boot() {
  try {
    state.session = await loadJson("/api/v1/session");
    renderSession();
    bindLoginForm();
    bindIdentityButtons();
    bindLogoutButton();
    bindHomeTitleButton();
    if (state.session.authenticated && state.session.currentUser) {
      await loadAppData();
    }
    startClocks();
  } catch (error) {
    setStatus(`초기 로딩 실패: ${error instanceof Error ? error.message : String(error)}`, true);
    if (apiLog) apiLog.textContent = statusStrip.textContent;
  }
}

bindTabs();
boot();
