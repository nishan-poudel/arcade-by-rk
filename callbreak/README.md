# Call Break

The Nepali trick-taking card game — spades are always trump, 4 players, calls
and tricks decide your score. Two ways to play:

- **Online** (`/play`) — deal virtual cards and play a full 4-player game
  together, live, from your own phones.
- **In-person score keeper** (`/score`) — playing with a real deck? Track
  everyone's calls and tricks here; the leaderboard updates live on every
  phone after every round, with a "who moved up" animation.

This is a **standalone app**, separate from the Imposter/Traitor games in the
rest of this repo (which are untouched). It deploys to **Cloudflare Workers**
on the **free plan** — no D1, no KV, no R2. A room's entire state lives in its
own Durable Object (SQLite-backed, included on Workers Free), so the whole
game costs nothing beyond the Workers Free plan's generous daily limits.

## Project layout

```
callbreak/
├── shared-logic/   Framework-free TS: deck/shuffle/deal, trick legality
│                   (incl. the "must trump if void" rule), Nepali scoring.
│                   Used by both the online game and the score keeper.
├── api/            Cloudflare Worker — GameRoom + ScoreRoom Durable Objects,
│                   WebSocket Hibernation, rate limiting, input validation.
└── web/            Cloudflare Worker (static assets) — the Vue 3 SPA.
                     Design system (tokens, UI kit, fonts) ported from this
                     repo's Imposter/Traitor "juicy soda" look.
```

## Running locally

One-time setup:

```bash
cd callbreak
npm install
cp web/.env.example web/.env.local
```

Then, from `callbreak/`:

```bash
npm run dev
```

This starts both the API Worker (`wrangler dev`, http://localhost:8787 — runs
the real Workers + Durable Object runtime locally via `workerd`, no
Cloudflare account needed for this) and the Vite dev server
(http://localhost:5173) together.

**To actually play a 4-player game**, open `http://localhost:5173/play` in 4
browser tabs/profiles (or 4 phones on the same network, pointing
`VITE_CALLBREAK_API_URL` at your machine's LAN IP instead of `localhost`) —
one creates the room, the other three join with the room code. Same idea for
`http://localhost:5173/score` to try the in-person score keeper.

## Testing

```bash
npm run test        # shared-logic (Vitest) + api (Durable Object integration
                     # tests via @cloudflare/vitest-plugin, real Workers runtime)
npm run typecheck    # tsc (shared-logic, api) + vue-tsc (web)
npm run build        # production build of all three packages
npm run check        # all of the above
```

`shared-logic` covers the rules engine directly (dealing, trick legality
including the must-trump-if-void edge case, the scoring formula). `api`'s
tests drive real WebSocket connections against the actual Durable Object
classes — full lobby → bidding → trick play → scoring → next round, and the
score-keeper's round-entry validation — not mocks.

There's no automated UI test suite for `web` yet; the game and score-keeper
flows were manually verified end-to-end (4 simulated players/phones each) as
part of building this.

## Production URLs

- Web (play the game): `https://call-break-by-rk.nishan-poudel.workers.dev`
- API (Durable Objects, not visited directly): `https://call-break-by-rk-api.nishan-poudel.workers.dev`

Both are set via `env.production.name` in each `wrangler.jsonc` — Worker
names are what determine the `*.workers.dev` URL, so renaming either one
(e.g. to move onto a custom domain later) means updating that file plus
`CORS_ALLOWED_ORIGINS` in `api/wrangler.jsonc` to match. No `preview`
environment is used for this project — production only.

## Continuous deploy: Cloudflare Workers Builds

Both Workers are Git-connected (dashboard → each Worker → **Settings →
Builds**) to this repo's `imp-call-break` branch, so **every push to that
branch deploys straight to production** — no manual `wrangler deploy` needed
day to day, and no review step in between. Run `npm run check` locally
before pushing if you want a safety net.

Configuration for each Worker — **Root directory must be the exact folder
containing that Worker's `wrangler.jsonc`** (not the `callbreak` workspace
root, and not the repo root). If Cloudflare can't find a wrangler config
directly in Root directory, it silently falls back to framework
auto-detection instead of using your build/deploy commands — which is what
happens if this is set wrong: it'll pick up the *other* app's
`vite.config.ts` at the repo root and misidentify this as a Vite frontend
project. Verified locally that `npm install` from either folder below still
correctly resolves `@callbreak/shared-logic` by walking up to
`callbreak/package.json`, and that plain `wrangler deploy` needs no
`--config` flag once it's sitting next to its own `wrangler.jsonc`:

| Worker | Root directory | Build command | Deploy command |
|---|---|---|---|
| `call-break-by-rk` (web) | `callbreak/web` | `npm install && npm run build` | `npx wrangler deploy --env production` |
| `call-break-by-rk-api` (api) | `callbreak/api` | `npm install` | `npx wrangler deploy --env production` |

The **web** Worker also needs a build variable (same Settings → Builds page)
so the built app knows where to connect:
```
VITE_CALLBREAK_API_URL = wss://call-break-by-rk-api.nishan-poudel.workers.dev
```

## What you need to do in Cloudflare before deploying (manual, one-time / as-needed)

Nothing beyond a Cloudflare account and the `wrangler` CLI — there's no
database to provision. This is the manual path (Workers Builds above covers
day-to-day deploys automatically once set up).

1. **Log in once, locally:**
   ```bash
   cd callbreak/api && npx wrangler login
   ```
   (skip if you're already logged in from deploying another Cloudflare
   project on this machine).

2. **Deploy the API first** — this also runs the Durable Object SQLite
   migration automatically (declared in `api/wrangler.jsonc`, no manual step
   like D1 needs):
   ```bash
   cd callbreak/api
   npx wrangler deploy --env production
   ```

3. **Point the web build at the API URL, then deploy it:**
   ```bash
   cd callbreak/web
   VITE_CALLBREAK_API_URL=wss://call-break-by-rk-api.nishan-poudel.workers.dev npm run build
   npx wrangler deploy --env production
   ```

4. **CORS** — `api/wrangler.jsonc`'s `env.production.vars.CORS_ALLOWED_ORIGINS`
   must exactly match the deployed web URL (no trailing slash). Already set
   correctly for the URLs above; update both if either Worker is ever renamed.

5. **Custom domain (optional)** — not required to run on the free
   `*.workers.dev` URLs above. If you attach one later (e.g. a `callbreak.`
   subdomain of a domain you already have on Cloudflare), add it to the
   `routes` in both `wrangler.jsonc` files (commented examples are already
   there) and redeploy both.

6. **No secrets to set** — this app has no login, no email, no PII, so there's
   nothing to `wrangler secret put`.

To redeploy after code changes, repeat steps 2–3 (CORS only needs updating if
the web Worker's URL ever changes).

## Design notes

- **Rules**: one fixed Nepali ruleset (spades always trump, must-trump-if-void,
  calls 1–13, make = call + 0.1/overtrick, miss = −call). The only
  host-configurable setting is round count (3/5/7, default 5).
- **Cards**: hand-drawn flat vector SVGs (`web/src/components/cards/`) — no
  external card-asset library. Suit glyphs are built from simple circle/path
  primitives, sized with CSS container-query units so one card component
  works at every size (hand fan vs. the trick table).
- **Real-time**: plain WebSocket + JSON messages over the WebSocket
  Hibernation API — not Socket.IO (Durable Objects don't speak that
  protocol). Workers never sleep the way a free Render instance does, so
  there's no cold-start delay to design around on reconnect.
