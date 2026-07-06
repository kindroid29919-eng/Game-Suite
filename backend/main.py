"""
AhaD's Games Hub — FastAPI Backend
Deployed on Render (Free Tier). May sleep after 15 min idle; wakes in ~30s.

This backend handles Supabase operations for Hand Cricket career stats.
The game logic itself runs client-side in React (no network round-trip per ball).
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import httpx

app = FastAPI(title="AhaD Games Hub API", version="1.0.0")

# Allow requests from Vercel frontend and localhost dev
ALLOWED_ORIGINS = [
    "https://*.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production if desired
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

def sb_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

# ── Models ────────────────────────────────────────────────────────────────────

class UpsertStatsRequest(BaseModel):
    username: str
    won: bool
    tied: bool
    runs: int
    balls: int
    outs: int
    runs_conceded: int
    balls_bowled: int
    catches: int
    runouts: int
    stumpings: int
    bowl_wkts: int

class LogBallRequest(BaseModel):
    username: str
    batter_num: int
    bowler_num: int
    outcome: str
    player_role: str

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/player/{username}")
async def get_player(username: str):
    """Load career stats for a player."""
    url = f"{SUPABASE_URL}/rest/v1/hc_players?username=eq.{username}&limit=1"
    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers=sb_headers())
    if r.status_code != 200:
        raise HTTPException(status_code=500, detail="Supabase error")
    data = r.json()
    if not data:
        # Create new player
        blank = {
            "username": username, "matches": 0, "wins": 0, "losses": 0, "ties": 0,
            "bat_runs": 0, "bat_balls": 0, "bat_outs": 0, "bat_hs": 0,
            "bowl_wkts": 0, "bowl_runs": 0, "bowl_balls": 0,
            "catches": 0, "runouts": 0, "stumpings": 0,
        }
        url2 = f"{SUPABASE_URL}/rest/v1/hc_players"
        async with httpx.AsyncClient() as client:
            await client.post(url2, headers=sb_headers(), json=blank)
        return blank
    return data[0]


@app.post("/api/player/stats")
async def upsert_stats(req: UpsertStatsRequest):
    """Upsert career stats after a match."""
    # Load existing
    url = f"{SUPABASE_URL}/rest/v1/hc_players?username=eq.{req.username}&limit=1"
    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers=sb_headers())
    ex = r.json()[0] if r.json() else {}

    def a(k, v):
        return ex.get(k, 0) + v

    row = {
        "username":    req.username,
        "matches":     a("matches", 1),
        "wins":        a("wins",    1 if req.won else 0),
        "losses":      a("losses",  1 if not req.won and not req.tied else 0),
        "ties":        a("ties",    1 if req.tied else 0),
        "bat_runs":    a("bat_runs",   req.runs),
        "bat_balls":   a("bat_balls",  req.balls),
        "bat_outs":    a("bat_outs",   req.outs),
        "bat_hs":      max(ex.get("bat_hs", 0), req.runs),
        "bowl_wkts":   a("bowl_wkts",  req.bowl_wkts),
        "bowl_runs":   a("bowl_runs",  req.runs_conceded),
        "bowl_balls":  a("bowl_balls", req.balls_bowled),
        "catches":     a("catches",    req.catches),
        "runouts":     a("runouts",    req.runouts),
        "stumpings":   a("stumpings",  req.stumpings),
    }
    url2 = f"{SUPABASE_URL}/rest/v1/hc_players"
    headers = {**sb_headers(), "Prefer": "resolution=merge-duplicates,return=representation"}
    async with httpx.AsyncClient() as client:
        r2 = await client.post(url2, headers=headers, json=row)
    if r2.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail="Failed to upsert")
    return {"ok": True}


@app.post("/api/ball")
async def log_ball(req: LogBallRequest):
    """Log a single ball for cross-user AI learning."""
    url = f"{SUPABASE_URL}/rest/v1/hc_balls"
    payload = {
        "username":    req.username,
        "batter_num":  req.batter_num,
        "bowler_num":  req.bowler_num,
        "outcome":     req.outcome,
        "player_role": req.player_role,
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(url, headers=sb_headers(), json=payload)
    if r.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail="Failed to log ball")
    return {"ok": True}


@app.get("/api/global-batter-nums")
async def global_batter_nums():
    """Get global batter numbers for Expert AI cold-start seeding."""
    url = f"{SUPABASE_URL}/rest/v1/hc_balls?select=batter_num&limit=10000"
    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers=sb_headers())
    if r.status_code != 200:
        return {"nums": []}
    return {"nums": [row["batter_num"] for row in r.json()]}
