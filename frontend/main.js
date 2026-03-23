import { getJson, sendJson } from "/src/api.js";

const state = {
  session: null,
  home: null,
  posts: null,
};

const apiLog = document.getElementById("api-log");
const statusStrip = document.getElementById("status-strip");
const sessionChip = document.getElementById("session-chip");
let clocksStarted = false;

function logApi(label, payload) {
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

function renderClock(targetId, tz) {
  const now = new Date();
  const text = new Intl.DateTimeFormat("ko-KR", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);
  document.getElementById(targetId).textContent = text;
}

function startClocks() {
  if (clocksStarted) return;
  clocksStarted = true;
  const tick = () => {
    renderClock("clock-seoul", "Asia/Seoul");
    renderClock("clock-asuncion", "America/Asuncion");
  };
  tick();
  setInterval(tick, 1000);
}

function setStatus(message, isError = false) {
  statusStrip.textContent = message;
  statusStrip.classList.toggle("error", Boolean(isError));
}

function renderSession() {
  if (!state.session) return;
  const { currentUser, people, mode } = state.session;
  sessionChip.textContent = `${people[currentUser]} · ${mode}`;
  setStatus(`세션 확인 완료. 현재 사용자는 ${people[currentUser]}이고, Cloudflare pilot은 ${mode} 모드로 동작 중입니다.`);
  document.getElementById("mood-mode-pill").textContent = mode.toUpperCase();
}

function renderHome() {
  if (!state.home || !state.session) return;
  const { dday, recentPosts, mood, calendar } = state.home;
  const { people, currentUser } = state.session;

  document.getElementById("dday-label").textContent = dday.label;
  document.getElementById("dday-title").textContent = dday.title;
  document.getElementById("dday-progress-text").textContent = dday.progress.text;
  document.getElementById("dday-progress-bar").style.width = `${dday.progress.percent}%`;
  document.getElementById("dday-form-title").value = dday.title || "";
  document.getElementById("dday-form-start").value = dday.startDate || "";
  document.getElementById("dday-form-target").value = dday.targetDate || "";

  const moodStrip = document.getElementById("mood-strip");
  moodStrip.innerHTML = Object.entries(mood.latest).map(([key, value]) => `
    <div class="mood-pill ${key === currentUser ? "mine" : ""}">
      <strong>${people[key]}</strong>
      <span class="mood-emoji-large">${value.emoji}</span>
    </div>
  `).join("");

  const moodPicker = document.getElementById("mood-picker");
  moodPicker.innerHTML = mood.stickers.map((item) => `
    <button class="emoji-btn ${item.id === mood.today?.moodId ? "active" : ""}" type="button" data-mood-id="${item.id}" title="${item.label}">${item.emoji}</button>
  `).join("");

  const recentList = document.getElementById("recent-list");
  recentList.innerHTML = recentPosts.map((post) => `
    <article class="recent-item">
      <div class="row-between">
        <strong>${people[post.owner]}</strong>
        <span class="muted small">${post.recordDate}</span>
      </div>
      <p>${post.summary || "요약 없음"}</p>
    </article>
  `).join("");

  document.getElementById("calendar-title").textContent = `${calendar.currentMonth} 달력`;
  const calendarGrid = document.getElementById("calendar-grid");
  const weekNames = ["일", "월", "화", "수", "목", "금", "토"];
  calendarGrid.innerHTML = weekNames.map((day) => `<div class="week-header">${day}</div>`).join("") +
    calendar.weeks.flat().map((cell) => {
      const posts = calendar.dateMap[cell.date] || [];
      return `
        <div class="day-cell ${cell.inMonth ? "" : "dim"}">
          <p class="day-number">${cell.day}</p>
          ${posts.map((post) => `<span class="mini-post">${people[post.owner]}</span>`).join("")}
        </div>
      `;
    }).join("");

  bindMoodButtons();
  bindDdayForm();
}

function renderBoard() {
  if (!state.posts || !state.session) return;
  const { items } = state.posts;
  const { people } = state.session;
  const boardGrid = document.getElementById("board-grid");
  boardGrid.innerHTML = items.map((post) => `
    <article class="card post-card">
      <div class="row-between section-head compact">
        <strong>${people[post.owner]} ${post.isNew ? '<span class="new-badge">NEW</span>' : ""}</strong>
        <span class="muted small">${post.recordDate}</span>
      </div>
      ${post.images.length ? `
        <div class="image-stack">
          ${post.images.map((src) => `<img src="${src}" alt="게시물 이미지" />`).join("")}
        </div>
      ` : ""}
      <div class="note">
        <p>${post.content}</p>
      </div>
      <section class="comments-box">
        <h3>댓글</h3>
        <div class="comment-list">
          ${post.comments.length ? post.comments.map((comment) => `
            <p><strong>${people[comment.author] || comment.author}</strong> · ${comment.content}</p>
          `).join("") : '<p class="muted small">아직 댓글이 없어요.</p>'}
        </div>
        <form class="comment-form" data-post-id="${post.id}">
          <textarea name="content" rows="3" placeholder="짧게 댓글 남기기"></textarea>
          <button type="submit">댓글 남기기</button>
        </form>
      </section>
    </article>
  `).join("");

  bindCommentForms();
}

function bindTabs() {
  document.querySelectorAll("[data-tab-target]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(button.dataset.tabTarget)?.classList.add("active");
    });
  });
}

function bindMoodButtons() {
  document.querySelectorAll("[data-mood-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        button.disabled = true;
        setStatus("기분 스티커 저장 중...");
        const result = await postJson("/api/v1/moods", { moodId: button.dataset.moodId });
        state.home = result.home;
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
    const payload = {
      title: String(formData.get("title") || "").trim(),
      startDate: String(formData.get("startDate") || ""),
      targetDate: String(formData.get("targetDate") || ""),
    };
    const submitButton = form.querySelector("button[type='submit']");
    try {
      if (submitButton) submitButton.disabled = true;
      setStatus("D-day 저장 중...");
      const result = await postJson("/api/v1/dday", payload);
      state.home = result.home;
      renderHome();
      setStatus("D-day 설정을 저장했습니다.");
    } catch (error) {
      setStatus(`D-day 저장 실패: ${error instanceof Error ? error.message : String(error)}`, true);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

function bindCommentForms() {
  document.querySelectorAll(".comment-form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const postId = form.dataset.postId;
      const textarea = form.querySelector("textarea[name='content']");
      const submitButton = form.querySelector("button[type='submit']");
      const content = String(textarea?.value || "").trim();
      if (!content) return;
      try {
        if (submitButton) submitButton.disabled = true;
        setStatus("댓글 저장 중...");
        const result = await postJson(`/api/v1/posts/${postId}/comments`, { content });
        state.posts = result.posts;
        renderBoard();
        setStatus("댓글을 저장했습니다.");
      } catch (error) {
        setStatus(`댓글 저장 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    }, { once: true });
  });
}

async function boot() {
  try {
    const [session, home, posts] = await Promise.all([
      loadJson("/api/v1/session"),
      loadJson("/api/v1/home"),
      loadJson("/api/v1/posts"),
    ]);
    state.session = session;
    state.home = home;
    state.posts = posts;
    renderSession();
    renderHome();
    renderBoard();
    startClocks();
  } catch (error) {
    setStatus(`초기 로딩 실패: ${error instanceof Error ? error.message : String(error)}`, true);
    apiLog.textContent = statusStrip.textContent;
  }
}

document.getElementById("health-check")?.addEventListener("click", async () => {
  try {
    const data = await loadJson("/api/v1/health");
    setStatus(`헬스 체크 완료: ${data.status}`);
  } catch (error) {
    setStatus(`헬스 체크 실패: ${error instanceof Error ? error.message : String(error)}`, true);
  }
});

bindTabs();
boot();
