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

## What you need to do in Cloudflare before deploying

Nothing beyond a Cloudflare account and the `wrangler` CLI — there's no
database to provision.

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
   Note the URL it prints (something like
   `https://callbreak-api-production.<your-subdomain>.workers.dev`).

3. **Point the web build at that API URL, then deploy it:**
   ```bash
   cd callbreak/web
   VITE_CALLBREAK_API_URL=wss://callbreak-api-production.<your-subdomain>.workers.dev npm run build
   npx wrangler deploy --env production
   ```

4. **Update CORS** — edit `api/wrangler.jsonc`'s `env.production.vars.CORS_ALLOWED_ORIGINS`
   to the *exact* web Worker URL from step 3 (no trailing slash), then re-run
   step 2's deploy so it takes effect.

5. **That's it for a free `*.workers.dev` launch** — no DNS, no domain
   required. If you want a custom domain later (e.g. a `callbreak.` subdomain
   of a domain you already have on Cloudflare), add it to the `routes` in
   both `wrangler.jsonc` files (commented examples are already there) and
   redeploy both.

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
