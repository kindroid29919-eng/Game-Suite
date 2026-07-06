# AhaD's Games Hub — Python Backend

FastAPI backend for Supabase operations. Deploy to Render (Free Tier).

> **Note**: The React frontend calls Supabase directly using the anon key,
> so this backend is optional. Use it if you want server-side control over
> Supabase operations or want to add server-side logic later.

## Deploy to Render

1. Push this project to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Set **Root Directory** to `backend`
5. Set **Build Command**: `pip install -r requirements.txt`
6. Set **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
7. Add environment variables:
   - `SUPABASE_URL` = your Supabase project URL
   - `SUPABASE_ANON_KEY` = your Supabase anon key
8. After deploy, copy the Render URL and set it in your Vercel frontend as `VITE_API_URL`

## Local Development

```bash
cd backend
pip install -r requirements.txt
SUPABASE_URL=... SUPABASE_ANON_KEY=... uvicorn main:app --reload
```

## Endpoints

- `GET  /health` — health check
- `GET  /api/player/{username}` — load career stats
- `POST /api/player/stats` — upsert career stats after a match
- `POST /api/ball` — log a single ball (AI learning data)
- `GET  /api/global-batter-nums` — batter numbers for Expert AI seed
