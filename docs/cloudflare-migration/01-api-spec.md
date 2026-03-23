# Cloudflare Migration - API Spec

## Scope
This document defines the first-pass JSON API surface needed to migrate the current Flask app to Cloudflare while leaving the current Render deployment untouched.

Assumption:
- Existing Flask app remains the production system during migration.
- New Cloudflare build starts as a parallel implementation.
- First target architecture is `Cloudflare Pages + Workers/Pages Functions + existing Postgres`.

## Current feature groups mapped from Flask
- Auth/session
- Home dashboard
- Calendar
- Posts
- Comments
- Mood stickers
- D-day
- Bucket list
- QnA
- Notifications
- Backup/export/import
- Uploads/asset access
- Health

## API design principles
- All new endpoints are versioned under `/api/v1`.
- Server-rendered HTML responses become JSON responses.
- Authentication uses signed cookie session.
- Image upload stays on Cloudinary in phase 1.
- Dates are exchanged as ISO strings.
- Timestamps are exchanged as UTC ISO strings.

## Auth
### POST /api/v1/auth/login
Purpose:
- Replace `POST /login`.

Request body:
```json
{
  "password": "string"
}
```

Response 200:
```json
{
  "ok": true,
  "needsIdentity": true
}
```

Response 401:
```json
{
  "ok": false,
  "error": "INVALID_PASSWORD"
}
```

Notes:
- Sets signed session cookie.
- Does not yet choose `you/partner` identity.

### POST /api/v1/auth/identity
Purpose:
- Replace `POST /whoami`.

Request body:
```json
{
  "user": "you"
}
```

Response 200:
```json
{
  "ok": true,
  "currentUser": "you"
}
```

### POST /api/v1/auth/logout
Purpose:
- Replace `GET /logout` with explicit mutation endpoint.

Response 200:
```json
{
  "ok": true
}
```

### GET /api/v1/session
Purpose:
- Bootstrap current auth state for Pages frontend.

Response 200:
```json
{
  "authenticated": true,
  "currentUser": "you",
  "people": {
    "you": "구현",
    "partner": "지원"
  },
  "notificationUnread": 3
}
```

## Home + Calendar
### GET /api/v1/home
Purpose:
- Replace `GET /home` template render.

Query params:
- `month=YYYY-MM` optional

Response 200:
```json
{
  "dday": {
    "title": "우리의 D-day",
    "startDate": "2026-01-01",
    "targetDate": "2026-05-01",
    "label": "D-39",
    "progress": {
      "percent": 62,
      "text": "62.0%"
    }
  },
  "recentPosts": [
    {
      "id": 123,
      "owner": "you",
      "recordDate": "2026-03-23",
      "summary": "...",
      "createdAt": "2026-03-23T10:30:00Z"
    }
  ],
  "mood": {
    "today": {
      "moodId": "love",
      "emoji": "🥰"
    },
    "latest": {
      "you": {"moodId": "love", "emoji": "🥰"},
      "partner": {"moodId": "miss", "emoji": "🥹"}
    },
    "stickers": [
      {"id": "love", "emoji": "🥰", "label": "love"}
    ]
  },
  "calendar": {
    "currentMonth": "2026-03",
    "prevMonth": "2026-02",
    "nextMonth": "2026-04",
    "weeks": [],
    "dateMap": {}
  }
}
```

### GET /api/v1/calendar
Purpose:
- Replace `GET /calendar`.

Query params:
- `month=YYYY-MM`

Response 200:
```json
{
  "currentMonth": "2026-03",
  "prevMonth": "2026-02",
  "nextMonth": "2026-04",
  "weeks": [],
  "dateMap": {}
}
```

## Mood
### POST /api/v1/moods
Purpose:
- Replace `POST /mood`.

Request body:
```json
{
  "moodId": "love"
}
```

Response 200:
```json
{
  "ok": true
}
```

## D-day
### POST /api/v1/dday
Purpose:
- Replace `POST /dday`.

Request body:
```json
{
  "title": "우리의 D-day",
  "startDate": "2026-01-01",
  "targetDate": "2026-05-01"
}
```

Response 200:
```json
{
  "ok": true,
  "dday": {
    "title": "우리의 D-day",
    "label": "D-39"
  }
}
```

## Posts
### GET /api/v1/posts
Purpose:
- Replace `GET /board` and list sections in `/person/<owner>`.

Query params:
- `page` integer
- `owner` optional: `you|partner`
- `perPage` optional

Response 200:
```json
{
  "items": [
    {
      "id": 123,
      "owner": "you",
      "content": "...",
      "summary": "...",
      "recordDate": "2026-03-23",
      "createdAt": "2026-03-23T10:30:00Z",
      "isNew": true,
      "images": ["https://..."],
      "comments": [
        {
          "id": 99,
          "author": "partner",
          "content": "...",
          "createdAt": "2026-03-23T10:40:00Z"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "perPage": 6,
    "totalPages": 4,
    "totalItems": 21
  }
}
```

### POST /api/v1/posts
Purpose:
- Replace post creation from `POST /person/<owner>`.

Request:
- `multipart/form-data`
- fields:
  - `content`
  - `recordDate`
  - `images[]`

Response 201:
```json
{
  "ok": true,
  "postId": 123
}
```

### PATCH /api/v1/posts/:postId
Purpose:
- Replace `POST /post/<int:post_id>/edit`.

Request body:
```json
{
  "content": "...",
  "recordDate": "2026-03-23"
}
```

### DELETE /api/v1/posts/:postId
Purpose:
- Replace `POST /post/<int:post_id>/delete`.

Response 200:
```json
{
  "ok": true
}
```

## Comments
### POST /api/v1/posts/:postId/comments
Purpose:
- Replace `POST /post/<int:post_id>/comment`.

Request body:
```json
{
  "content": "..."
}
```

Response 201:
```json
{
  "ok": true,
  "commentId": 555
}
```

## Bucket
### GET /api/v1/bucket
Query params:
- `page`
- `owner=all|me|partner`
- `status=all|open|done`

### POST /api/v1/bucket
Request body:
```json
{
  "content": "같이 먹고 싶은 것"
}
```

### PATCH /api/v1/bucket/:itemId/toggle
### DELETE /api/v1/bucket/:itemId

## QnA
### GET /api/v1/qna
Query params:
- `page`
- `owner=all|me|partner`
- `status=all|open|answered`

### POST /api/v1/qna
Request body:
```json
{
  "question": "오늘 어땠어?"
}
```

### PATCH /api/v1/qna/:questionId
### DELETE /api/v1/qna/:questionId
### PATCH /api/v1/qna/:questionId/answer
### DELETE /api/v1/qna/:questionId/answer

## Notifications
### GET /api/v1/notifications
Response 200:
```json
{
  "items": [
    {
      "id": 1,
      "type": "post_created",
      "actor": "you",
      "target": "partner",
      "message": "구현님이 새로운 글을 올렸어요.",
      "link": "/board#post-123",
      "createdAt": "2026-03-23T10:30:00Z",
      "isRead": false
    }
  ]
}
```

### POST /api/v1/notifications/read-all
Purpose:
- Explicitly mark all visible notifications as read.

## Backup
### GET /api/v1/backup/export
Purpose:
- Replace `GET /backup/export`.
- Returns JSON or downloadable blob.

### POST /api/v1/backup/import
Purpose:
- Replace `POST /backup/import`.
- Admin-only operation.

## Uploads
### POST /api/v1/uploads/image
Purpose:
- Phase 1 upload endpoint for Cloudinary-signed or server-proxied upload.

Response 201:
```json
{
  "ok": true,
  "url": "https://res.cloudinary.com/..."
}
```

## Health
### GET /api/v1/health
Response 200:
```json
{
  "status": "ok"
}
```

## Phase 1 cut line
Required for pilot migration:
- `/api/v1/session`
- `/api/v1/home`
- `/api/v1/calendar`
- `/api/v1/posts`
- `/api/v1/auth/login`
- `/api/v1/auth/identity`
- `/api/v1/auth/logout`
- `/api/v1/moods`
- `/api/v1/dday`

Can stay on Flask until phase 2:
- Bucket
- QnA
- Notifications
- Backup/import/export

## Notes on compatibility
- Existing SQL schema can remain during phase 1.
- Existing Cloudinary integration can remain during phase 1.
- Existing notification generation logic can remain conceptually unchanged; only transport changes from template redirect flow to JSON API flow.