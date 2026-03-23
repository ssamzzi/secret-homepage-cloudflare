# Cloudflare Migration - Env And Setup Checklist

## Purpose
This is the exact checklist needed when we switch the Cloudflare pilot from mock data to real production-like data.

## Not needed yet
At the current stage, the pilot runs with mock API responses.
You do not need to enter production secrets yet for the current preview to load.

## Needed next for real data
### Required Worker secrets/vars
- `DATABASE_URL`
- `SITE_PASSWORD`
- `SESSION_SECRET`
- `DISPLAY_TIMEZONE`

### Later, when upload migration starts
- `CLOUDINARY_URL`

## Recommended Worker variables setup
In Cloudflare Worker settings, add:
- `DATA_MODE=real` when we are ready to stop using mock data
- `DISPLAY_TIMEZONE=Asia/Seoul`

Until then, keep:
- `DATA_MODE=mock`

## Hyperdrive recommendation
Recommended path:
- keep existing Postgres
- add Hyperdrive between Worker and Postgres

Why:
- lower migration risk
- no schema rewrite yet
- Flask app and Cloudflare pilot can read the same data source

## What you will need to prepare for me later
1. confirmation that you want `mock -> real` switch
2. Cloudflare Worker env values prepared
3. preferably Hyperdrive created, if you choose to use it immediately

## Safe rollout suggestion
1. keep Render production alive
2. keep Cloudflare in `mock` mode while UI stabilizes
3. switch to `real` mode only after env values are ready
4. compare Home and Board outputs side by side
5. continue with login and write actions after read parity is confirmed
