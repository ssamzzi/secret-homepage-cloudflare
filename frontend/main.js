import { getJson, sendJson } from "/src/api.js";

const state = {
  session: null,
  home: null,
  person: null,
  posts: null,
};

const apiLog = document.getElementById("api-log");
const statusStrip = document.getElementById("status-strip");
const sessionChip = document.getElementById("session-chip");
const loginPanel = document.getElementById("login-panel");
const identityPanel = document.getElementById("identity-panel");
const appContent = document.getElementById("app-content");
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

function showAppStage(stage) {
  loginPanel.hidden = stage !== "login";
  identityPanel.hidden = stage !== "identity";
  appContent.hidden = stage !== "app";
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
  const { currentUser, people, mode, authenticated } = state.session;
  document.getElementById("mood-mode-pill").textContent = mode.toUpperCase();

  if (!authenticated) {
    showAppStage("login");
    setStatus("비밀번호를 입력하면 Cloudflare 버전에 들어갈 수 있습니다.");
    return;
  }

  if (!currentUser) {
    showAppStage("identity");
    setStatus("지원/구현 중 현재 사용자를 먼저 선택해주세요.");
    return;
  }

  showAppStage("app");
  sessionChip.textContent = `${people[currentUser]} · ${mode}`;
  setStatus(`세션 확인 완료. 현재 사용자는 ${people[currentUser]}이고, Cloudflare pilot은 ${mode} 모드로 동작 중입니다.`);
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

function renderPerson() {
  if (!state.person || !state.session) return;
  const { people } = state.session;
  const { ownerName, posts } = state.person;

  document.getElementById("person-title").textContent = `${ownerName} 페이지`;
  const recordDateInput = document.getElementById("person-record-date");
  if (!recordDateInput.value) {
    recordDateInput.value = new Date().toISOString().slice(0, 10);
  }

  const personPosts = document.getElementById("person-posts");
  personPosts.innerHTML = posts.length
    ? posts.map((post) => `
      <article class="card person-post-card">
        <div class="row-between section-head compact">
          <strong>${ownerName} ${post.isNew ? '<span class="new-badge">NEW</span>' : ""}</strong>
          <span class="muted small">${post.recordDate}</span>
        </div>
        ${post.images.length ? `
          <div class="image-stack">
            ${post.images.map((src) => `<img src="${src}" alt="게시물 이미지" />`).join("")}
          </div>
        ` : ""}
        <p class="post-content">${post.content}</p>
        <details class="editor-box person-edit-box">
          <summary>수정</summary>
          <form class="stack-form post-edit-form" data-post-id="${post.id}">
            <label>
              <span>기록 날짜</span>
              <input type="date" name="recordDate" value="${post.recordDate}" required />
            </label>
            <label>
              <span>내용</span>
              <textarea name="content" rows="4" required>${post.content}</textarea>
            </label>
            <button type="submit">수정 저장</button>
          </form>
        </details>
        <div class="post-actions">
          <button type="button" class="danger-btn" data-delete-post-id="${post.id}">삭제</button>
        </div>
        <div class="comment-list compact-comments">
          ${post.comments.length ? post.comments.map((comment) => `
            <p><strong>${people[comment.author] || comment.author}</strong> · ${comment.content}</p>
          `).join("") : '<p class="muted small">댓글은 보드에서 달 수 있어요.</p>'}
        </div>
      </article>
    `).join("")
    : '<article class="card"><p>아직 기록이 없어요.</p></article>';

  bindPersonCreateForm();
  bindPostEditForms();
  bindPostDeleteButtons();
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
      const result = await postJson("/api/v1/login", {
        password: String(formData.get("password") || ""),
      });
      state.session = result.session;
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
    button.addEventListener("click", async () => {
      try {
        button.disabled = true;
        setStatus("사용자 선택 중...");
        const result = await postJson("/api/v1/whoami", { currentUser: button.dataset.identity });
        state.session = result.session;
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
      document.getElementById("dday-editor")?.removeAttribute("open");
      setStatus("D-day 설정을 저장했습니다.");
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
    const formData = new FormData(form);
    const payload = {
      recordDate: String(formData.get("recordDate") || ""),
      content: String(formData.get("content") || "").trim(),
    };
    const submitButton = form.querySelector("button[type='submit']");
    try {
      if (submitButton) submitButton.disabled = true;
      setStatus("기록 저장 중...");
      const result = await postJson(`/api/v1/person/${state.session.currentUser}/posts`, payload);
      state.person = result.person;
      renderPerson();
      form.reset();
      document.getElementById("person-record-date").value = new Date().toISOString().slice(0, 10);
      setStatus("기록을 저장했습니다.");
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
      const postId = form.dataset.postId;
      const formData = new FormData(form);
      const payload = {
        recordDate: String(formData.get("recordDate") || ""),
        content: String(formData.get("content") || "").trim(),
      };
      const submitButton = form.querySelector("button[type='submit']");
      try {
        if (submitButton) submitButton.disabled = true;
        setStatus("글 수정 중...");
        const result = await postJson(`/api/v1/posts/${postId}/edit`, payload);
        state.person = result.person;
        renderPerson();
        setStatus("글을 수정했습니다.");
      } catch (error) {
        setStatus(`글 수정 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    }, { once: true });
  });
}

function bindPostDeleteButtons() {
  document.querySelectorAll("[data-delete-post-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const ok = confirm("이 기록을 삭제할까요?");
      if (!ok) return;
      try {
        button.disabled = true;
        setStatus("글 삭제 중...");
        const result = await postJson(`/api/v1/posts/${button.dataset.deletePostId}/delete`, {});
        state.person = result.person;
        renderPerson();
        setStatus("글을 삭제했습니다.");
      } catch (error) {
        setStatus(`글 삭제 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      } finally {
        button.disabled = false;
      }
    }, { once: true });
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

async function loadAppData() {
  const [home, person, posts] = await Promise.all([
    loadJson("/api/v1/home"),
    loadJson(`/api/v1/person/${state.session.currentUser}`),
    loadJson("/api/v1/posts"),
  ]);
  state.home = home;
  state.person = person;
  state.posts = posts;
  renderHome();
  renderPerson();
  renderBoard();
}

async function boot() {
  try {
    state.session = await loadJson("/api/v1/session");
    renderSession();
    bindLoginForm();
    bindIdentityButtons();
    bindLogoutButton();
    if (state.session.authenticated && state.session.currentUser) {
      await loadAppData();
    }
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
