export const people = {
  you: "구현",
  partner: "지원",
};

export const moodStickers = [
  { id: "love", emoji: "🥰", label: "love" },
  { id: "miss", emoji: "🥹", label: "miss" },
  { id: "happy", emoji: "😊", label: "happy" },
  { id: "excited", emoji: "🤭", label: "excited" },
  { id: "sleepy", emoji: "😴", label: "sleepy" },
  { id: "busy", emoji: "🤯", label: "busy" },
  { id: "tired", emoji: "😵", label: "tired" },
  { id: "hug", emoji: "🤗", label: "hug" },
  { id: "kiss", emoji: "😘", label: "kiss" },
  { id: "cheer", emoji: "💪", label: "cheer" }
];

export const recentPosts = [
  { id: 231, owner: "you", recordDate: "2026-03-22", createdAt: "2026-03-22T14:10:00Z", summary: "오늘은 같이 먹고 싶은 메뉴를 잔뜩 떠올렸어. 집 가는 길에 사진도 많이 찍었고, 보고 싶은 마음이 더 커졌어." },
  { id: 230, owner: "partner", recordDate: "2026-03-21", createdAt: "2026-03-21T22:35:00Z", summary: "바쁜 하루였는데도 마지막에 네 생각하면서 웃었어. 우리 D-day가 조금씩 줄어드는 게 큰 위로야." },
  { id: 229, owner: "you", recordDate: "2026-03-20", createdAt: "2026-03-20T09:00:00Z", summary: "오늘의 하늘이 예뻐서 남겨뒀어. 나중에 같이 보면 좋을 것 같아." }
];

export const boardPosts = [
  {
    id: 231,
    owner: "you",
    recordDate: "2026-03-22",
    createdAt: "2026-03-22T14:10:00Z",
    isNew: true,
    content: "오늘은 같이 먹고 싶은 메뉴를 잔뜩 떠올렸어. 집 가는 길에 사진도 많이 찍었고, 보고 싶은 마음이 더 커졌어.",
    summary: "오늘은 같이 먹고 싶은 메뉴를 잔뜩 떠올렸어.",
    images: [
      "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80"
    ],
    comments: [
      { id: 1, author: "partner", content: "이 사진 분위기 너무 좋다.", createdAt: "2026-03-22T14:30:00Z" },
      { id: 2, author: "partner", content: "다음엔 같이 먹자.", createdAt: "2026-03-22T14:31:00Z" }
    ]
  },
  {
    id: 230,
    owner: "partner",
    recordDate: "2026-03-21",
    createdAt: "2026-03-21T22:35:00Z",
    isNew: true,
    content: "바쁜 하루였는데도 마지막에 네 생각하면서 웃었어. 우리 D-day가 조금씩 줄어드는 게 큰 위로야.",
    summary: "바쁜 하루였는데도 마지막에 네 생각하면서 웃었어.",
    images: ["https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80"],
    comments: [{ id: 3, author: "you", content: "나도 같은 마음이야.", createdAt: "2026-03-21T23:00:00Z" }]
  },
  { id: 229, owner: "you", recordDate: "2026-03-20", createdAt: "2026-03-20T09:00:00Z", isNew: false, content: "오늘의 하늘이 예뻐서 남겨뒀어. 나중에 같이 보면 좋을 것 같아.", summary: "오늘의 하늘이 예뻐서 남겨뒀어.", images: [], comments: [] },
  { id: 228, owner: "partner", recordDate: "2026-03-19", createdAt: "2026-03-19T10:20:00Z", isNew: false, content: "오늘은 유난히 네 목소리가 듣고 싶었던 날. 짧게 통화해도 하루가 버텨져.", summary: "오늘은 유난히 네 목소리가 듣고 싶었던 날.", images: [], comments: [{ id: 4, author: "you", content: "언제든 전화해도 돼.", createdAt: "2026-03-19T10:50:00Z" }] },
  { id: 227, owner: "you", recordDate: "2026-03-18", createdAt: "2026-03-18T18:40:00Z", isNew: false, content: "다시 같이 걷고 싶은 길을 적어뒀어. 나중에 하나씩 다시 가보자.", summary: "다시 같이 걷고 싶은 길을 적어뒀어.", images: [], comments: [] },
  { id: 226, owner: "partner", recordDate: "2026-03-17", createdAt: "2026-03-17T07:50:00Z", isNew: false, content: "출근 전에 짧게 남기는 기록. 오늘도 잘 보내고 밤에 또 얘기하자.", summary: "출근 전에 짧게 남기는 기록.", images: [], comments: [] }
];

export const personPayload = {
  owner: "you",
  ownerName: people.you,
  isMyPage: true,
  posts: boardPosts.filter((post) => post.owner === "you"),
  pagination: { page: 1, perPage: 15, totalPages: 1, totalItems: boardPosts.filter((post) => post.owner === "you").length }
};

export const bucketPayload = {
  items: [
    { id: 1, owner: "you", content: "같이 밤바다 보러 가기", isDone: false, createdAt: "2026-03-10T10:00:00Z" },
    { id: 2, owner: "partner", content: "재회하면 사진 인화하기", isDone: true, createdAt: "2026-03-09T12:00:00Z" }
  ],
  ownerFilter: "all",
  statusFilter: "all",
  pagination: { page: 1, perPage: 15, totalPages: 1, totalItems: 2 }
};

export const qnaPayload = {
  items: [
    { id: 1, author: "you", target: "partner", question: "요즘 제일 듣고 싶은 말은 뭐야?", answer: "수고했어, 오늘도 잘 버텼어.", answeredBy: "partner", createdAt: "2026-03-12T12:00:00Z", answeredAt: "2026-03-12T14:00:00Z" },
    { id: 2, author: "partner", target: "you", question: "재회하면 가장 먼저 뭐 하고 싶어?", answer: null, answeredBy: null, createdAt: "2026-03-14T09:00:00Z", answeredAt: null }
  ],
  scopeFilter: "all",
  progressFilter: "all",
  pagination: { page: 1, perPage: 15, totalPages: 1, totalItems: 2 }
};

export const notificationsPayload = {
  items: [
    { id: 11, eventType: "new_post", actor: "you", target: "partner", message: "구현님이 새 기록을 남겼어요.", link: "#board-panel", createdAt: "2026-03-22T14:10:00Z", seenAt: null },
    { id: 10, eventType: "qna_answered", actor: "partner", target: "you", message: "지원님이 질문에 답했어요.", link: "#qna-panel", createdAt: "2026-03-21T23:00:00Z", seenAt: "2026-03-22T00:00:00Z" }
  ]
};

export const backupPayload = {
  exportedAt: "2026-03-23T00:00:00Z",
  siteTitle: "강구현지원",
  posts: boardPosts,
  bucketItems: bucketPayload.items,
  questions: qnaPayload.items,
  notifications: notificationsPayload.items,
  dday: {
    title: homePayload.dday.title,
    start_date: homePayload.dday.startDate,
    target_date: homePayload.dday.targetDate,
  },
};

export const homePayload = {
  dday: { title: "우리의 D-day", startDate: "2026-01-15", targetDate: "2026-05-01", label: "D-39", progress: { percent: 62, text: "62.0%" } },
  recentPosts,
  mood: {
    today: { moodId: "love", emoji: "🥰" },
    latest: { you: { moodId: "love", emoji: "🥰" }, partner: { moodId: "miss", emoji: "🥹" } },
    stickers: moodStickers
  },
  calendar: {
    currentMonth: "2026-03",
    prevMonth: "2026-02",
    nextMonth: "2026-04",
    weeks: [
      [{ date: "2026-03-01", day: 1, inMonth: true }, { date: "2026-03-02", day: 2, inMonth: true }, { date: "2026-03-03", day: 3, inMonth: true }, { date: "2026-03-04", day: 4, inMonth: true }, { date: "2026-03-05", day: 5, inMonth: true }, { date: "2026-03-06", day: 6, inMonth: true }, { date: "2026-03-07", day: 7, inMonth: true }],
      [{ date: "2026-03-08", day: 8, inMonth: true }, { date: "2026-03-09", day: 9, inMonth: true }, { date: "2026-03-10", day: 10, inMonth: true }, { date: "2026-03-11", day: 11, inMonth: true }, { date: "2026-03-12", day: 12, inMonth: true }, { date: "2026-03-13", day: 13, inMonth: true }, { date: "2026-03-14", day: 14, inMonth: true }],
      [{ date: "2026-03-15", day: 15, inMonth: true }, { date: "2026-03-16", day: 16, inMonth: true }, { date: "2026-03-17", day: 17, inMonth: true }, { date: "2026-03-18", day: 18, inMonth: true }, { date: "2026-03-19", day: 19, inMonth: true }, { date: "2026-03-20", day: 20, inMonth: true }, { date: "2026-03-21", day: 21, inMonth: true }],
      [{ date: "2026-03-22", day: 22, inMonth: true }, { date: "2026-03-23", day: 23, inMonth: true }, { date: "2026-03-24", day: 24, inMonth: true }, { date: "2026-03-25", day: 25, inMonth: true }, { date: "2026-03-26", day: 26, inMonth: true }, { date: "2026-03-27", day: 27, inMonth: true }, { date: "2026-03-28", day: 28, inMonth: true }],
      [{ date: "2026-03-29", day: 29, inMonth: true }, { date: "2026-03-30", day: 30, inMonth: true }, { date: "2026-03-31", day: 31, inMonth: true }, { date: "2026-04-01", day: 1, inMonth: false }, { date: "2026-04-02", day: 2, inMonth: false }, { date: "2026-04-03", day: 3, inMonth: false }, { date: "2026-04-04", day: 4, inMonth: false }]
    ],
    dateMap: { "2026-03-17": [{ id: 226, owner: "partner" }], "2026-03-18": [{ id: 227, owner: "you" }], "2026-03-19": [{ id: 228, owner: "partner" }], "2026-03-20": [{ id: 229, owner: "you" }], "2026-03-21": [{ id: 230, owner: "partner" }], "2026-03-22": [{ id: 231, owner: "you" }] }
  }
};

export const postsPayload = { items: boardPosts, pagination: { page: 1, perPage: 6, totalPages: 1, totalItems: 6 } };
