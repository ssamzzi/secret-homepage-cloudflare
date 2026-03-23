# Cloudflare Migration - Home And Board Pilot Design

## Purpose
This pilot is the lowest-risk starting point for the Cloudflare migration.

Why Home + Board first:
- they are the most frequently visited screens
- they benefit the most from removing Render cold starts
- they prove read-heavy and light write flows
- they expose the main visual identity of the site

## Pilot boundaries
Included in pilot:
- login bootstrap
- who-am-I identity selection
- home screen data
- board list data
- board pagination
- comments on board
- mood sticker update
- D-day update

Not included in pilot:
- bucket list
- qna
- backup
- import/export
- upload path migration beyond keeping Cloudinary

## Screen mapping
### Login screen
Current Flask screens:
- `/`
- `/whoami`

Cloudflare pilot screens:
- `/login`
- `/identity`

### Home screen
Current Flask screen:
- `/home`

Cloudflare pilot screen:
- `/`

### Board screen
Current Flask screen:
- `/board`

Cloudflare pilot screen:
- `/board`

## Frontend page composition
### Home page
Sections:
- top hero / quick actions
- mood sticker strip
- D-day card
- clocks card
- recent posts list
- collapsible calendar

Data requirements:
- current session
- people labels
- latest moods
- today mood for current user
- dday config and computed label/progress
- recent posts summaries
- calendar weeks/date map for selected month

API dependencies:
- `GET /api/v1/session`
- `GET /api/v1/home?month=YYYY-MM`
- `POST /api/v1/moods`
- `POST /api/v1/dday`

### Board page
Sections:
- board header
- post cards with images/comments inline
- pagination

Data requirements:
- post list
- image urls
- comments
- isNew marker
- pagination metadata

API dependencies:
- `GET /api/v1/posts?page=1&perPage=6`
- `POST /api/v1/posts/:postId/comments`

## UX behavior in pilot
### Home load
Sequence:
1. frontend boots
2. checks `/api/v1/session`
3. if not authenticated, redirect to `/login`
4. if authenticated but no identity, redirect to `/identity`
5. fetch `/api/v1/home`
6. render screen

### Board load
Sequence:
1. session check
2. fetch `/api/v1/posts?page=n&perPage=6`
3. render cards and pagination

### Form mutations
On success:
- update local state optimistically only for lightweight interactions if easy
- otherwise refetch the page-level resource

Initial recommendation:
- do not over-optimize state management in pilot
- use simple refetch after mutation

## Suggested frontend stack
Recommendation:
- `Vite + React + TypeScript` on Cloudflare Pages

Reason:
- low friction with Pages
- easy client routing if needed
- straightforward data fetching
- simple incremental growth

## Suggested worker route layout
```text
worker/src/
  index.ts
  routes/
    auth.ts
    session.ts
    home.ts
    calendar.ts
    posts.ts
    comments.ts
    moods.ts
    dday.ts
  db/
    postgres.ts
    homeQueries.ts
    postQueries.ts
  auth/
    cookies.ts
```

## Data contract details
### Home contract
Worker assembles one combined payload instead of many small calls.

Reason:
- fewer round trips
- simpler frontend bootstrap
- easier to keep parity with current Flask home render

### Board contract
Worker returns fully expanded posts for the board page.

Reason:
- current UI shows images and comments inline
- this keeps parity with current behavior
- user explicitly asked to keep comments/images visible without extra clicks

## SQL/query behavior
### Home
Queries:
- current D-day setting
- latest mood per user
- recent post summaries limit 3
- monthly calendar post map

### Board
Queries:
- post page using `LIMIT/OFFSET`
- comments by post ids
- images by post ids
- total count for pagination

## State and auth design
### Cookie
Use signed cookie containing:
```json
{
  "authenticated": true,
  "currentUser": "you",
  "lastSeenNotificationId": 123
}
```

### Access checks
Every API route should validate:
- authenticated session exists
- current identity exists for mutations tied to `you/partner`

## File/image plan for pilot
Keep image URLs in Cloudinary if already uploaded there.

For uploads in pilot:
- either upload through Worker to Cloudinary
- or generate signed upload params and upload directly from browser

Recommendation:
- direct browser-to-Cloudinary upload if implementation stays simple
- Worker stores returned URL in Postgres

## Comparison checklist against current site
### Home parity
- mood stickers visible
- current user sticker visible
- D-day edit works
- clocks update every second
- recent posts count is 3
- collapsible calendar works

### Board parity
- 6 posts per page
- images visible immediately
- comments visible immediately
- comment submit works
- pagination numbers match backend count

## Implementation sequence for pilot
1. Create Pages frontend shell
2. Create Worker session/auth endpoints
3. Create Worker home endpoint
4. Build Home page in Pages
5. Create Worker posts/comments endpoints
6. Build Board page in Pages
7. Add D-day and mood mutations
8. Verify parity against Flask app

## Acceptance criteria
Pilot is successful when:
- login to Cloudflare frontend works
- Home and Board feel faster than Render version
- data matches current production data
- daily use for reading and light interaction is stable
- there is no need to wake a sleeping Render instance to view Home/Board

## What we should not do in the pilot
- do not move every page at once
- do not migrate to D1 yet
- do not replace Cloudinary yet unless forced
- do not delete Flask routes yet
- do not switch DNS until pilot parity is proven