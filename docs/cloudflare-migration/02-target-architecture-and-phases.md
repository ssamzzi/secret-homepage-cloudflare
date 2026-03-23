# Cloudflare Migration - Target Architecture And Phases

## Goal
Move away from Render free cold starts while keeping the current site running during the migration.

Primary objective:
- Improve first-load responsiveness
- Preserve existing features
- Avoid a risky full rewrite in one step

Recommended target:
- `Cloudflare Pages` for frontend
- `Cloudflare Workers` or `Pages Functions` for API
- `Postgres` kept initially
- `Hyperdrive` between Workers and Postgres
- `Cloudinary` kept initially for images

## Why this target is the best fit
The current app is not a static HTML site.
It includes:
- password auth
- identity switching
- sessions
- database reads/writes
- comments
- uploads
- backup export/import
- notification state

Because of that, converting the whole project to static HTML would create more work than moving to a frontend/API split.

## Recommended repo shape
Target shape for the migration work:

```text
secret-homepage/
  app.py                        # existing Flask app stays intact during migration
  templates/                    # existing Jinja UI stays intact during migration
  static/
  docs/
    cloudflare-migration/
      01-api-spec.md
      02-target-architecture-and-phases.md
      03-home-board-pilot-design.md
  cloudflare/
    frontend/
      package.json
      src/
        pages/
          Home/
          Board/
          Person/
          Login/
        components/
        lib/
          api.ts
          auth.ts
          date.ts
        styles/
      public/
      wrangler.toml             # only if using Pages + Workers in same project setup
    worker/
      src/
        index.ts                # router entry
        routes/
          auth.ts
          home.ts
          posts.ts
          moods.ts
          dday.ts
        db/
          postgres.ts
          queries/
        auth/
          session.ts
        utils/
      package.json
      wrangler.toml
```

## Operational model during migration
Two systems run in parallel.

### Existing production
- Render
- Flask app
- current domain or subdomain

### New migration environment
- Cloudflare Pages preview domain
- Cloudflare Worker preview/staging API
- same underlying Postgres data in phase 1

This means:
- We do not replace the current site immediately.
- We can compare behavior before a cutover.
- We reduce launch risk.

## Suggested environment split
### Phase 1 environments
- `render-prod`: current live Flask app
- `cf-staging`: Pages + Worker connected to same database in read/write mode only after auth is stable
- `cf-preview`: preview deployment for UI checks

### Secrets/config expected on Cloudflare
- `SITE_PASSWORD`
- `SESSION_SECRET`
- `DATABASE_URL` or Hyperdrive binding
- `CLOUDINARY_URL` or upload credentials
- `DISPLAY_TIMEZONE`

## Migration phases
### Phase 0 - Freeze architecture boundaries
Goal:
- Stop mixing migration work with production behavior changes.

Tasks:
- Keep Flask app as source of truth.
- Add migration docs.
- Decide frontend stack for Pages.
- Decide Worker runtime: JS/TS preferred, Python optional.

Deliverable:
- approved architecture and API plan

### Phase 1 - Build read-first frontend shell
Goal:
- New frontend can render login/session/home/board using API data.

Tasks:
- Set up Pages frontend project.
- Create shared layout and auth bootstrap.
- Implement `/api/v1/session`, `/api/v1/home`, `/api/v1/calendar`, `/api/v1/posts`.
- Rebuild Home and Board in the new frontend.

Deliverable:
- cloudflare staging URL showing working login + home + board

### Phase 2 - Add write flows
Goal:
- New frontend is usable for daily activity.

Tasks:
- Create auth mutation endpoints.
- Add post creation.
- Add comments.
- Add mood update.
- Add D-day update.
- Add image upload flow.

Deliverable:
- home, board, and posting work end-to-end on Cloudflare

### Phase 3 - Migrate secondary sections
Goal:
- Reach feature parity for regular users.

Tasks:
- bucket list
- qna
- notifications
- person page write/edit/delete paths

Deliverable:
- Cloudflare site is functionally equivalent for daily use

### Phase 4 - Admin and maintenance features
Goal:
- Move the low-frequency operational flows.

Tasks:
- backup export/import
- legacy upload path cleanup
- health and monitoring

Deliverable:
- Cloudflare site supports operational maintenance too

### Phase 5 - Cutover
Goal:
- Move traffic to Cloudflare.

Tasks:
- verify auth cookies on production domain
- verify image upload on production domain
- verify pagination and timezone behavior
- keep Render live as rollback target
- switch DNS/app links gradually

Deliverable:
- Cloudflare becomes primary production

## Decision: Worker runtime
### Best recommendation
Use `TypeScript Workers` for phase 1.

Reason:
- strongest Cloudflare support path
- best examples and ecosystem fit
- easiest access to Hyperdrive, R2, D1, KV bindings

### Acceptable but not first choice
Use `Python Workers`.

Reason:
- closer to current Python skillset
- but runtime path is newer and less mature for this kind of migration
- not ideal when we want the smoothest migration path

## Data strategy
### Phase 1
Keep current Postgres.

Why:
- avoids schema rewrite
- lowers migration risk
- allows old and new apps to use the same data

### Phase 2 or later
Evaluate D1 only after the new frontend/API is stable.

Why:
- changing app platform and database at the same time is unnecessary risk

## File storage strategy
### Phase 1
Keep Cloudinary.

Why:
- current image flow already conceptually fits CDN-backed storage
- avoids building an R2 migration at the same time

### Phase 2 or later
Optional move to R2 if cost or control becomes a stronger reason

## Auth strategy
Use signed HTTP-only cookies.

Suggested fields inside the session payload:
- authenticated: true/false
- currentUser: `you|partner`
- lastSeenNotificationId

Do not use localStorage for auth.

## Rollback strategy
Rollback must stay simple.

If Cloudflare launch fails:
- keep Render deployment live
- revert domain to current app
- keep data in Postgres unchanged

This is one more reason not to move the database first.

## Exit criteria for production cutover
All of these should be true:
- login works on production domain
- identity selection works
- home data matches Flask app
- board pagination and comments match Flask app
- image upload works on mobile
- time display is correct in Korea/Paraguay use cases
- no cold-start waiting experience on the new stack

## Recommendation summary
Recommended path:
1. Keep Flask app running.
2. Build new Pages frontend beside it.
3. Build Worker API against existing Postgres.
4. Move Home and Board first.
5. Add write flows.
6. Move secondary pages.
7. Cut over only after parity is proven.