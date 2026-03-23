import { getJson } from "/src/api.js";

const state = {
  session: null,
  home: null,
  posts: null,
};

const apiLog = document.getElementById("api-log");
const statusStrip = document.getElementById("status-strip");
const sessionChip = document.getElementById("session-chip");

function logApi(label, payload) {
  apiLog.textContent = `${label}\n${JSON.stringify(payload, null, 2)}`;
}

async function loadJson(url) {
  const data = await getJson(url);
  logApi(`GET ${url}`, data);
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
  const tick = () => {
    renderClock("clock-seoul", "Asia/Seoul");
    renderClock("clock-asuncion", "America/Asuncion");
  };
  tick();
  setInterval(tick, 1000);
}

function renderSession() {
  if (!state.session) return;
  const { currentUser, people, mode } = state.session;
  sessionChip.textContent = `${people[currentUser]} · ${mode}`;
  statusStrip.textContent = `세션 확인 완료. 현재 사용자는 ${people[currentUser]}이고, Cloudflare pilot은 ${mode} 모드로 동작 중입니다.`;
}

function renderHome() {
  if (!state.home || !state.session) return;
  const { dday, recentPosts, mood, calendar } = state.home;
  const { people } = state.session;

  document.getElementById("dday-label").textContent = dday.label;
  document.getElementById("dday-title").textContent = dday.title;
  document.getElementById("dday-progress-text").textContent = dday.progress.text;
  document.getElementById("dday-progress-bar").style.width = `${dday.progress.percent}%`;

  const moodStrip = document.getElementById("mood-strip");
  moodStrip.innerHTML = Object.entries(mood.latest).map(([key, value]) => `
    <div class="mood-pill ${key === state.session.currentUser ? "mine" : ""}">
      <strong>${people[key]}</strong>
      <span>${value.emoji}</span>
    </div>
  `).join("");

  const moodPicker = document.getElementById("mood-picker");
  moodPicker.innerHTML = mood.stickers.map((item) => `
    <button class="emoji-btn ${item.id === mood.today.moodId ? "active" : ""}" type="button">${item.emoji}</button>
  `).join("");

  const recentList = document.getElementById("recent-list");
  recentList.innerHTML = recentPosts.map((post) => `
    <article class="recent-item">
      <div class="row-between">
        <strong>${people[post.owner]}</strong>
        <span class="muted small">${post.recordDate}</span>
      </div>
      <p>${post.summary}</p>
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
        ${post.comments.length ? post.comments.map((comment) => `
          <p><strong>${people[comment.author]}</strong> · ${comment.content}</p>
        `).join("") : '<p class="muted small">아직 댓글이 없어요.</p>'}
      </section>
    </article>
  `).join("");
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
    statusStrip.textContent = `초기 로딩 실패: ${error instanceof Error ? error.message : String(error)}`;
    apiLog.textContent = statusStrip.textContent;
  }
}

document.getElementById("health-check")?.addEventListener("click", async () => {
  try {
    const data = await loadJson("/api/v1/health");
    statusStrip.textContent = `헬스 체크 완료: ${data.status}`;
  } catch (error) {
    statusStrip.textContent = `헬스 체크 실패: ${error instanceof Error ? error.message : String(error)}`;
  }
});

bindTabs();
boot();
