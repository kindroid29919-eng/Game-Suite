# AhaD's Games Hub

A personal arcade with 3 browser games: Rock Paper Scissors, Guess the Number, and Hand Cricket — built in React + Vite, deployable to Vercel (frontend) and Render (Python backend).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/games-hub/src/` — React frontend (Vite, wouter, Tailwind dark theme)
- `artifacts/games-hub/src/pages/` — Home, RockPaperScissors, GuessTheNumber, HandCricket
- `artifacts/games-hub/src/lib/cricketAI.ts` — Full Hand Cricket AI engine (Classic + Expert modes)
- `artifacts/games-hub/src/lib/supabase.ts` — Supabase client + career stats helpers
- `artifacts/games-hub/src/components/` — Keypad, Banner, StatCell shared components
- `backend/` — Python FastAPI backend (for Render deployment, optional)

## Architecture decisions

- Supabase anon key used directly in the React frontend (it's the public key, designed for browser use)
- Hand Cricket AI runs fully in the browser (TypeScript port) — zero network latency per ball
- Python backend in `backend/` is optional; the React app works standalone with direct Supabase calls
- Dark mode is always on (class="dark" on html element), no light mode toggle needed
- Vite BASE_PATH prefix handled via wouter router base; all routes are path-prefixed correctly

## Product

- **Home**: Hub with cards for all 3 games
- **Rock Paper Scissors**: Battle arena vs computer, session score tracking
- **Guess the Number**: 1-100 guessing game with Too High/Too Low hints
- **Hand Cricket**: Full T20 match vs CricBot — toss, bat/bowl, 0-6 keypad input, career stats saved to Supabase, Classic + Expert AI modes

## User preferences

- Always dark mode; use Space Grotesk + Space Mono + Orbitron fonts
- Mobile-first layout (max 480px content, everything fits without scrolling during cricket gameplay)
- Supabase tables: `hc_players` (career stats) and `hc_balls` (ball log for Expert AI)

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
