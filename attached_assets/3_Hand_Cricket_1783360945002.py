import math
import os
import random
import streamlit as st
from collections import Counter

# ── Supabase (optional — app fully works without it; persistence is disabled) ──
try:
    from supabase import create_client as _sb_create
    _SB_AVAILABLE = True
except ImportError:
    _SB_AVAILABLE = False

_SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
_SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

@st.cache_resource
def _get_sb():
    if _SB_AVAILABLE and _SUPABASE_URL and _SUPABASE_KEY:
        try:
            return _sb_create(_SUPABASE_URL, _SUPABASE_KEY)
        except Exception:
            return None
    return None

st.set_page_config(page_title="Hand Cricket", page_icon="🏏", layout="centered")

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Space+Mono:wght@400;700&family=Space+Grotesk:wght@400;600;700&display=swap');

html, body, [class*="css"] {
    font-family: 'Space Grotesk', sans-serif;
    background-color: #06060f;
    color: #e0e0f0;
}
.stApp { background: #06060f; }
[data-testid="stSidebar"] { background: #0a0a18; border-right: 1px solid #1a1a30; }

/* ── TITLE ── */
.game-title {
    text-align: center;
    padding: 0.6rem 0 0.2rem 0;
}
.game-title h1 {
    font-family: 'Orbitron', monospace;
    font-size: 1.6rem;
    font-weight: 900;
    color: #fff;
    margin: 0;
    letter-spacing: 0.08em;
    text-shadow: 0 0 20px #00ff8888, 0 0 40px #00ff8844;
}
.game-title p {
    font-size: 0.65rem;
    color: #444466;
    margin: 0.15rem 0 0 0;
    letter-spacing: 0.2em;
    text-transform: uppercase;
}
.divider {
    border: none;
    border-top: 1px solid #1a1a30 !important;
    margin: 0.5rem 0;
}

/* ── Kill Streamlit's default blue hr ── */
hr {
    border: none !important;
    border-top: 1px solid #1a1a30 !important;
    background: none !important;
    margin: 0.5rem 0 !important;
}
.stMarkdown hr, .element-container hr, [data-testid] hr {
    border: none !important;
    border-top: 1px solid #1a1a30 !important;
    background: none !important;
}

/* ── SCOREBOARD ── */
.scoreboard-main {
    background: linear-gradient(135deg, #0d0d1f 0%, #111128 100%);
    border: 1px solid #2a2a50;
    border-radius: 16px;
    padding: 0.8rem 1rem;
    text-align: center;
    margin: 0.3rem 0;
    box-shadow: 0 0 30px #00ff8811, inset 0 1px 0 #ffffff0a;
    position: relative;
    overflow: hidden;
}
.scoreboard-main::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, #00ff88, transparent);
}
.scoreboard-main .inn-label {
    font-size: 0.58rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: #5555aa;
    margin-bottom: 0.15rem;
}
.scoreboard-main .score-big {
    font-family: 'Orbitron', monospace;
    font-size: 2.4rem;
    font-weight: 900;
    color: #fff;
    line-height: 1;
    text-shadow: 0 0 20px #00ff8866;
}
.scoreboard-main .score-overs {
    font-family: 'Space Mono', monospace;
    font-size: 0.75rem;
    color: #6666aa;
    margin-top: 0.2rem;
}
.scoreboard-side {
    background: #0d0d1f;
    border: 1px solid #1e1e3a;
    border-radius: 16px;
    padding: 0.8rem 0.6rem;
    text-align: center;
    margin: 0.3rem 0;
}
.scoreboard-side .inn-label {
    font-size: 0.58rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: #444466;
    margin-bottom: 0.1rem;
}
.scoreboard-side .score-mid {
    font-family: 'Orbitron', monospace;
    font-size: 1.4rem;
    font-weight: 700;
    color: #818cf8;
}
.scoreboard-side .score-sub {
    font-size: 0.62rem;
    color: #444466;
    margin-top: 0.1rem;
}

/* ── LIVE STATS GRID ── */
.stats-grid {
    display: grid;
    gap: 0.35rem;
    margin: 0.4rem 0;
}
.stats-grid-2 { grid-template-columns: repeat(2, 1fr); }
.stats-grid-3 { grid-template-columns: repeat(3, 1fr); }
.stats-grid-4 { grid-template-columns: repeat(4, 1fr); }
.stats-grid-6 { grid-template-columns: repeat(6, 1fr); }
.stat-cell {
    background: #0d0d1f;
    border: 1px solid #1e1e3a;
    border-radius: 10px;
    padding: 0.45rem 0.3rem;
    text-align: center;
}
.stat-cell .sv {
    font-family: 'Space Mono', monospace;
    font-size: 1.05rem;
    font-weight: 700;
    color: #fff;
    line-height: 1;
}
.stat-cell .sl {
    font-size: 0.52rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #7777aa;
    margin-top: 0.2rem;
}
.sv-green  { color: #00ff88 !important; text-shadow: 0 0 8px #00ff8866; }
.sv-red    { color: #ff3366 !important; text-shadow: 0 0 8px #ff336666; }
.sv-blue   { color: #818cf8 !important; }
.sv-gold   { color: #ffd700 !important; text-shadow: 0 0 8px #ffd70066; }
.sv-orange { color: #ff9900 !important; }

/* ── BANNERS ── */
.banner {
    text-align: center;
    padding: 0.55rem 0.8rem;
    border-radius: 12px;
    margin: 0.4rem 0;
    font-family: 'Space Mono', monospace;
    font-size: 0.82rem;
    font-weight: 700;
}
.banner-out     { background: #2a0510; color: #ff3366; border: 1px solid #ff336644; box-shadow: 0 0 15px #ff336622; }
.banner-runs    { background: #003318; color: #00ff88; border: 1px solid #00ff8844; box-shadow: 0 0 15px #00ff8822; }
.banner-dot     { background: #0d0d2a; color: #818cf8; border: 1px solid #818cf833; }
.banner-info    { background: #0d0d1f; color: #6666aa; border: 1px solid #1e1e3a; font-size: 0.75rem; }
.banner-target  { background: #1a0a00; color: #ff9900; border: 1px solid #ff990044; }
.banner-win     { background: #003318; color: #00ff88; border: 1px solid #00ff88; font-size: 1.1rem; box-shadow: 0 0 30px #00ff8833; }
.banner-lose    { background: #2a0510; color: #ff3366; border: 1px solid #ff3366; font-size: 1.1rem; box-shadow: 0 0 30px #ff336633; }
.banner-tie     { background: #1a1000; color: #ffd700; border: 1px solid #ffd700; font-size: 1.1rem; box-shadow: 0 0 30px #ffd70033; }
.banner-six     { background: #1a1000; color: #ffd700; border: 1px solid #ffd70066; box-shadow: 0 0 20px #ffd70033; font-size: 1rem; }

/* ── BUTTONS ── */
div[data-testid="stButton"] > button {
    background: linear-gradient(135deg, #0d0d1f, #111128) !important;
    color: #c0c0e0 !important;
    border: 2px solid #2a2a50 !important;
    border-radius: 14px !important;
    font-family: 'Space Grotesk', sans-serif !important;
    font-weight: 600 !important;
    padding: 0.75rem 0.5rem !important;
    transition: all 0.12s ease !important;
    width: 100% !important;
    letter-spacing: 0.04em !important;
}
div[data-testid="stButton"] > button:hover {
    border-color: #00ff8866 !important;
    color: #00ff88 !important;
    background: linear-gradient(135deg, #091a10, #0d1520) !important;
    box-shadow: 0 0 15px #00ff8822 !important;
}
div[data-testid="stButton"] > button:active {
    transform: scale(0.97) !important;
    box-shadow: 0 0 25px #00ff8844 !important;
}

/* Toss buttons */
.btn-toss div[data-testid="stButton"] > button {
    font-family: 'Orbitron', monospace !important;
    font-size: 1rem !important;
    padding: 0.9rem 0.5rem !important;
}

/* ── TEXT INPUT (number entry) ── */
div[data-testid="stTextInput"] input {
    background: #0d0d1f !important;
    color: #00ff88 !important;
    border: 2px solid #2a2a50 !important;
    border-radius: 14px !important;
    font-family: 'Orbitron', monospace !important;
    font-size: 2.2rem !important;
    font-weight: 700 !important;
    text-align: center !important;
    padding: 0.6rem 0.5rem !important;
    letter-spacing: 0.15em !important;
    caret-color: #00ff88 !important;
}
div[data-testid="stTextInput"] input:focus {
    border-color: #00ff88 !important;
    box-shadow: 0 0 20px #00ff8833 !important;
    outline: none !important;
}
div[data-testid="stTextInput"] input::placeholder {
    color: #2a2a50 !important;
    font-size: 1rem !important;
    letter-spacing: 0.1em !important;
}
div[data-testid="stTextInput"] label { display: none !important; }

/* ── SUBMIT BUTTON (form) ── */
div[data-testid="stFormSubmitButton"] > button {
    background: linear-gradient(135deg, #003318, #001a0d) !important;
    color: #00ff88 !important;
    border: 2px solid #00ff8855 !important;
    border-radius: 14px !important;
    font-family: 'Orbitron', monospace !important;
    font-weight: 700 !important;
    font-size: 1rem !important;
    padding: 0.85rem 0.5rem !important;
    letter-spacing: 0.12em !important;
    width: 100% !important;
    transition: all 0.12s ease !important;
}
div[data-testid="stFormSubmitButton"] > button:hover {
    border-color: #00ff88 !important;
    box-shadow: 0 0 25px #00ff8855 !important;
    background: linear-gradient(135deg, #004d22, #002a10) !important;
}
div[data-testid="stFormSubmitButton"] > button:active {
    transform: scale(0.97) !important;
}

div[data-testid="stSelectbox"] > div { background: #0d0d1f !important; border-color: #2a2a50 !important; color: #e0e0f0 !important; }
div[data-testid="stNumberInput"] input { background: #0d0d1f !important; color: #e0e0f0 !important; border: 2px solid #2a2a50 !important; border-radius: 10px !important; font-family: 'Space Mono', monospace !important; }

/* Section labels */
.section-label {
    text-align: center;
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: #333355;
    margin: 0.5rem 0 0.3rem 0;
}
.catch-hint {
    text-align: center;
    color: #ffd700;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 0.5rem;
    font-family: 'Space Mono', monospace;
    text-shadow: 0 0 10px #ffd70066;
}
.role-badge {
    display: inline-block;
    padding: 0.25rem 0.9rem;
    border-radius: 20px;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    font-family: 'Space Mono', monospace;
}
.role-bat  { background: #003318; color: #00ff88; border: 1px solid #00ff8844; }
.role-bowl { background: #0a0035; color: #818cf8; border: 1px solid #818cf844; }

.stats-section-label {
    font-size: 0.58rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: #33335a;
    text-align: center;
    margin: 0.5rem 0 0.25rem 0;
}
.stats-divider {
    border: none;
    border-top: 1px solid #1a1a30;
    margin: 0.4rem 0;
}
.result-header {
    font-family: 'Orbitron', monospace;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    text-align: center;
    color: #33335a;
    margin: 0.5rem 0 0.3rem 0;
}
.player-name-label {
    font-family: 'Space Mono', monospace;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    text-align: center;
    padding: 0.3rem;
    border-radius: 8px;
    margin-bottom: 0.3rem;
}
.lbl-player { color: #00ff88; background: #003318; border: 1px solid #00ff8822; }
.lbl-bot    { color: #818cf8; background: #0a0035; border: 1px solid #818cf822; }

.footer { text-align: center; margin-top: 1.5rem; font-size: 0.6rem; color: #55557a; letter-spacing: 0.1em; font-family: 'Space Mono', monospace; }
.glow-green { text-shadow: 0 0 10px #00ff88; }

/* ── CAREER STATS BOX ── */
.career-box {
    background: linear-gradient(135deg, #09091a 0%, #0d0d22 100%);
    border: 1px solid #1a1a35;
    border-radius: 16px;
    padding: 1rem 0.8rem 1rem;
    margin-top: 1.2rem;
}
.career-title {
    font-family: 'Orbitron', monospace;
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    color: #4444aa;
    text-align: center;
    margin-bottom: 0.8rem;
}
.career-name {
    font-family: 'Orbitron', monospace;
    font-size: 1rem;
    font-weight: 700;
    color: #00ff88;
    text-align: center;
    text-shadow: 0 0 12px #00ff8855;
    margin-bottom: 0.6rem;
}
.career-section {
    font-size: 0.52rem;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: #444475;
    text-align: center;
    margin: 0.6rem 0 0.3rem;
    border-top: 1px solid #1a1a30;
    padding-top: 0.5rem;
}
.win-pill {
    display: inline-block;
    padding: 0.18rem 0.6rem;
    border-radius: 20px;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    font-family: 'Space Mono', monospace;
}
.pill-w  { background: #003318; color: #00ff88; border: 1px solid #00ff8844; }
.pill-l  { background: #2a0510; color: #ff3366; border: 1px solid #ff336644; }
.pill-t  { background: #1a1000; color: #ffd700; border: 1px solid #ffd70044; }
.pill-pct{ background: #0a0035; color: #818cf8; border: 1px solid #818cf844; }
.career-pills { text-align: center; margin-bottom: 0.3rem; }
.no-stats { text-align:center; color:#333360; font-size:0.7rem;
            font-family:'Space Mono',monospace; padding:0.6rem 0; }
</style>
""", unsafe_allow_html=True)

# ── AI (pro logic) ────────────────────────────────────────────────────────────
ai_patterns = {0:[4,5,6],1:[3,4,6],2:[2,6,5],3:[3,1,5],4:[4,5,1],5:[3,6,5],6:[6,3,4]}

def detect_cycle(history, max_cycle=3):
    for cycle_len in range(1, max_cycle + 1):
        needed = cycle_len * 2
        if len(history) < needed:
            continue
        recent = history[-needed:]
        first_half, second_half = recent[:cycle_len], recent[cycle_len:]
        if first_half == second_half:
            return history[-cycle_len]
    return None

def ai_bowler_choice(batter_history, own_history=None, target=None, score=0, balls_remaining=None):
    own_history = own_history or []
    base = 0.85
    if target is not None and balls_remaining and balls_remaining > 0:
        rr = (target - score) / (balls_remaining / 6)
        base = 0.93 if rr >= 5 else (0.8 if rr <= 2 else base)
        if balls_remaining <= 6 and rr >= 6:
            base = 0.97
    cycle_pick = detect_cycle(batter_history)
    if cycle_pick is not None and random.random() < 0.85:
        return cycle_pick
    if own_history and random.random() < 0.18:
        return own_history[-1]
    if own_history and batter_history and batter_history[-1] == own_history[-1]:
        mirror_len = 0
        for i in range(1, min(len(batter_history), len(own_history)) + 1):
            if batter_history[-i] == own_history[-i]:
                mirror_len += 1
            else:
                break
        if random.random() < min(0.9, 0.5 + 0.2 * mirror_len):
            return own_history[-1]
    if len(batter_history) >= 2 and batter_history[-1] == batter_history[-2]:
        if random.random() < 0.8:
            return batter_history[-1]
    if own_history and batter_history and own_history[-1] == batter_history[-1]:
        if random.random() < 0.45:
            return own_history[-1]
    if len(batter_history) >= 1 and random.random() < base:
        return random.choice(ai_patterns[batter_history[-1]])
    if len(batter_history) >= 3:
        freq = Counter(batter_history[-5:])
        favs = [n for n, _ in freq.most_common(2)]
        if favs: return random.choice(favs)
    return random.randint(0, 6)

def ai_batter_choice(bowler_history, own_history=None, score=0, target=None,
                      balls_remaining=0, wickets_remaining=1, total_overs=1):
    own_history = own_history or []
    balls_total = total_overs * 6
    balls_bowled = balls_total - balls_remaining
    overs_left = balls_remaining / 6 if balls_remaining else 0
    if target is None:
        progress = (balls_bowled / balls_total) if balls_total else 0
        aggression = 0.3 + 0.5 * progress
        if balls_remaining <= 6:
            aggression = max(aggression, 0.75)
        if wickets_remaining <= 1: aggression *= 0.6
    else:
        rr = ((target - score) / overs_left) if overs_left > 0 else 99
        runs_needed = target - score
        if runs_needed <= 0:
            aggression = 0.05
        else:
            aggression = min(1.0, max(0.05, rr / 6.0))
            if rr >= 9: aggression = 0.97
            elif rr >= 6.5: aggression = max(aggression, 0.9)
            elif rr >= 5: aggression = max(aggression, 0.75)
            if balls_remaining <= 6 and runs_needed > 0:
                needed_per_ball = runs_needed / balls_remaining
                if needed_per_ball >= 1.5: aggression = 0.97
                elif needed_per_ball >= 1.0: aggression = max(aggression, 0.85)
                elif needed_per_ball >= 0.6: aggression = max(aggression, 0.6)
            if rr <= 2.5 and overs_left >= 2:
                aggression = min(aggression, 0.35)
            if wickets_remaining <= 1 and rr < 4.5:
                aggression *= 0.55
    aggression = max(0.0, min(1.0, aggression))
    weights = [max(1.0 + aggression * n * 1.5 - (1 - aggression) * (n * 0.3), 0.05) for n in range(7)]
    cycle_pick = detect_cycle(bowler_history)
    if cycle_pick is not None:
        weights[cycle_pick] *= 0.15
    if len(bowler_history) >= 2 and bowler_history[-1] == bowler_history[-2]:
        weights[bowler_history[-1]] *= 0.1
    if bowler_history and random.random() < 0.12:
        weights[bowler_history[-1]] *= 1.6
    if own_history and bowler_history and own_history[-1] != bowler_history[-1] and own_history[-1] >= 4:
        if random.random() < 0.35:
            weights[own_history[-1]] *= 1.8
    if len(bowler_history) >= 2:
        freq = Counter(bowler_history[-5:])
        avoidance = 0.5 if aggression < 0.8 else 0.2
        for n in [x for x, _ in freq.most_common(2)]:
            weights[n] *= (1 - avoidance)
    total_w = sum(weights)
    return random.choices(range(7), weights=[w/total_w for w in weights], k=1)[0]

def determine_dismissal_type(number, batter_history):
    if random.random() < 0.10:
        return 'stump_chance'
    if 4 <= number <= 6:
        recent = batter_history[-5:]
        high_ratio = (sum(1 for n in recent if n in (4,5,6)) / len(recent)) if recent else 0
        if high_ratio >= 0.6 and random.random() < 0.55:
            return 'catch_chance'
        return 'bowled'
    elif 1 <= number <= 3:
        return 'runout_chance'
    return 'bowled'

def format_score(score, wickets_lost, balls_bowled, total_overs):
    overs = balls_bowled // 6; balls = balls_bowled % 6
    return f"{score}/{wickets_lost} ({overs}.{balls}/{total_overs} ov)"

# ── Expert AI ─────────────────────────────────────────────────────────────────
def _dist(scores=None):
    scores = scores or {}
    vals = [max(0.0, float(scores.get(n, 0.0))) for n in range(7)]
    total = sum(vals)
    return {n: (vals[n] / total if total else 1 / 7) for n in range(7)}

MODEL_NAMES = ("markov", "recent", "overall", "pressure", "psych", "mirror")

def _new_model_weights():
    return {name: 1.0 for name in MODEL_NAMES}

def _blend_counter(scores, counter, scale=1.0):
    total = sum(counter.values())
    if total:
        for n, v in counter.items():
            scores[n] += scale * (v / total)

def _randomness(seq):
    recent = seq[-18:]
    if len(recent) < 8:
        return 0.0
    freq = Counter(recent)
    probs = [v / len(recent) for v in freq.values()]
    entropy = -sum(p * math.log(p + 1e-9) for p in probs) / math.log(7)
    if detect_cycle(recent, 4) is not None:
        entropy *= 0.82
    if max(freq.values()) >= len(recent) * 0.34:
        entropy *= 0.82
    return max(0.0, min(1.0, entropy))

def _recent_distribution(seq):
    scores = Counter()
    for w, scale in ((5, 1.0), (10, 0.9), (20, 0.7), (50, 0.5)):
        recent = seq[-w:]
        if not recent:
            continue
        c = Counter(recent)
        for n, v in c.items():
            scores[n] += scale * (v / len(recent))
    conf = min(0.9, 0.18 + 0.72 * min(len(seq), 20) / 20)
    return _dist(scores), conf

def _overall_distribution(seq):
    conf = min(0.78, 0.12 + 0.66 * min(len(seq), 50) / 50)
    return _dist(Counter(seq)), conf if seq else 0.0

def _markov_distribution(seq):
    if len(seq) < 2:
        return _dist(), 0.0
    prev = seq[-1]
    scores = Counter(seq[i] for i in range(1, len(seq)) if seq[i - 1] == prev)
    hits = sum(scores.values())
    conf = min(0.98, 0.16 + 0.18 * hits) if hits else 0.0
    return _dist(scores), conf

def _psychology_distribution(seq, ctx):
    scores = Counter()
    overall = ctx.get("overall_seq", [])
    base = seq if len(seq) >= 6 else overall
    favs = Counter(base).most_common(3)
    for i, (n, _) in enumerate(favs):
        scores[n] += max(0.2, 1.1 - 0.25 * i)
    cyc = detect_cycle(seq, 4)
    if cyc is not None:
        scores[cyc] += 1.25
    if len(seq) >= 2 and seq[-1] == seq[-2]:
        scores[seq[-1]] += 1.1
    if len(seq) >= 4 and seq[-1] == seq[-3] and seq[-2] == seq[-4]:
        scores[seq[-2]] += 0.95
    if ctx.get("last_outcome") == "boundary":
        _blend_counter(scores, ctx.get("after_boundary", Counter()), 1.15)
    if ctx.get("last_outcome") == "wicket":
        _blend_counter(scores, ctx.get("after_wicket", Counter()), 1.25)
    conf = 0.15 + 0.15 * bool(favs) + 0.25 * (cyc is not None)
    if len(seq) >= 2 and seq[-1] == seq[-2]:
        conf += 0.18
    if len(seq) >= 4 and seq[-1] == seq[-3] and seq[-2] == seq[-4]:
        conf += 0.15
    conf *= (1 - 0.55 * _randomness(seq))
    return _dist(scores), max(0.0, min(0.9, conf))

def _pressure_distribution(seq, ctx):
    scores = Counter()
    role = ctx.get("role")
    target, score = ctx.get("target"), ctx.get("score", 0)
    balls_left = max(1, ctx.get("balls_remaining", 0))
    wkts = max(1, ctx.get("wickets_remaining", 1))
    if role == "bat":
        if target is None:
            total_balls = max(1, ctx.get("total_overs", 1) * 6)
            phase = 1 - (balls_left / total_balls)
            urgency = max(0.35, min(1.0, 0.35 + 0.6 * phase + (0.15 if balls_left <= 18 else 0)))
        else:
            runs_needed = max(target - score, 0)
            rr = runs_needed / max(balls_left / 6, 1 / 6)
            urgency = max(0.15, min(1.0, rr / 6.5))
            if balls_left <= 12 and runs_needed > 0:
                urgency = max(urgency, min(1.0, runs_needed / balls_left))
        if wkts <= 2 and urgency < 0.9:
            urgency *= 0.78
        if urgency >= 0.62:
            for n, w in ((3, 0.45), (4, 0.9), (5, 1.0), (6, 1.15)):
                scores[n] += w
            _blend_counter(scores, Counter([n for n in seq if n >= 4]), 1.05)
        else:
            for n, w in ((0, 0.2), (1, 1.0), (2, 1.05), (3, 0.8), (4, 0.35)):
                scores[n] += w
            _blend_counter(scores, Counter([n for n in seq if n <= 3]), 0.9)
        conf = 0.35 + 0.35 * abs(urgency - 0.5)
    else:
        urgency = 0.3
        if target is not None:
            runs_needed = max(target - score, 0)
            urgency = max(0.2, min(1.0, runs_needed / max(balls_left, 1) + (0.25 if balls_left <= 12 else 0)))
        if seq:
            scores[seq[-1]] += 0.6 if urgency >= 0.55 else 0.3
        _blend_counter(scores, Counter(seq[-10:]), 1.0 + 0.35 * urgency)
        if ctx.get("last_outcome") == "wicket":
            _blend_counter(scores, ctx.get("after_wicket", Counter()), 0.8)
        conf = 0.28 + 0.32 * min(1.0, len(seq) / 10)
    return _dist(scores), max(0.0, min(0.82, conf))

def _mirror_distribution(seq, own_seq):
    scores = Counter()
    window = 14
    recent_seq = seq[-window:]
    recent_own = own_seq[-(window + 1):]
    if len(recent_seq) < 4 or len(recent_own) < 5:
        return _dist(scores), 0.0
    checks = min(len(recent_seq), len(recent_own) - 1)
    hits = sum(1 for i in range(1, checks + 1) if recent_seq[-i] == recent_own[-(i + 1)])
    if checks == 0:
        return _dist(scores), 0.0
    copy_rate = hits / checks
    baseline = 1 / 7
    if copy_rate >= 0.30 and own_seq:
        target = own_seq[-1]
        scores[target] += 1.0 + 2.2 * copy_rate
        conf = max(0.0, min(0.85, (copy_rate - baseline) * 1.35))
    else:
        conf = 0.0
    return _dist(scores), conf

def _update_model_weights(role, actual, raw_dists):
    if not raw_dists:
        return
    weights = s.expert_weights.setdefault(role, _new_model_weights())
    eta = 0.55          # faster learning than before (was 0.35)
    baseline = 1 / 7
    for name, dist in raw_dists.items():
        prob = max(1e-6, dist.get(actual, baseline))
        relative = prob / baseline
        w = weights.get(name, 1.0) * (relative ** eta)
        weights[name] = max(0.05, min(8.0, w))  # wider cap → stronger models dominate faster

def expert_predict_player_number(seq, ctx):
    role = ctx.get("role", "bat")
    overall_seq = ctx.get("overall_seq", [])
    own_seq = ctx.get("own_seq", [])
    randomish = _randomness(seq)
    # Blend global batter patterns as a cold-start prior when local data is sparse
    global_seed = db_global_batter_nums() if len(seq) < 25 else []
    seeded_overall = list(overall_seq) + global_seed[:300] if global_seed else overall_seq
    raw_dists = {
        "markov": _markov_distribution(seq),
        "recent": _recent_distribution(seq),
        "overall": _overall_distribution(seeded_overall if seeded_overall else seq),
        "pressure": _pressure_distribution(seq, ctx),
        "psych": _psychology_distribution(seq, ctx),
        "mirror": _mirror_distribution(seq, own_seq),
    }
    flavor = {
        "markov": 1 - 0.15 * randomish, "recent": 1 + 0.08 * randomish,
        "overall": 1 + 0.25 * randomish, "pressure": 1.0,
        "psych": 1 - 0.5 * randomish, "mirror": 1.0,
    }
    dyn_weights = s.expert_weights.setdefault(role, _new_model_weights())
    total_dyn = sum(dyn_weights.get(name, 1.0) for name in raw_dists) or 1.0
    scores = Counter()
    confidences = {}
    for name, (dist, conf) in raw_dists.items():
        confidences[name] = round(conf, 3)
        weight = (dyn_weights.get(name, 1.0) / total_dyn) * flavor[name]
        for n, p in dist.items():
            scores[n] += weight * max(0.05, conf) * p
    s.expert_last_dists[role] = {name: dist for name, (dist, conf) in raw_dists.items()}
    return _dist(scores), confidences

def expert_bowler_choice(player_history, own_history=None, ctx=None):
    """Nightmare bowler: locks onto your most likely shot with minimal mercy."""
    own_history = own_history or []
    ctx = dict(ctx or {})
    ctx["own_seq"] = own_history
    prediction, _ = expert_predict_player_number(player_history, ctx)
    ranked = sorted(prediction.items(), key=lambda x: x[1], reverse=True)
    # Cold start: before 3 balls of data, use a slight weighted random
    if len(player_history) < 3:
        top = [n for n, _ in ranked[:3]]
        return random.choices(top, weights=[prediction[n] for n in top], k=1)[0]
    # Always pick the top predicted number — no random fallback
    choice = ranked[0][0]
    # Only switch if we've bowled the EXACT same number 4+ times in a row
    # (prevents 100% mechanical repetition while staying lethal)
    if (len(own_history) >= 4
            and all(x == choice for x in own_history[-4:])
            and len(ranked) > 1):
        choice = ranked[1][0]
    return choice

def expert_batter_choice(player_history, own_history=None, score=0, target=None,
                         balls_remaining=0, wickets_remaining=1, total_overs=20, ctx=None):
    """Nightmare batter: aggressively avoids predicted bowls and scores hard."""
    own_history = own_history or []
    ctx = dict(ctx or {})
    ctx.update({
        "role": "bowl", "score": score, "target": target,
        "balls_remaining": balls_remaining, "wickets_remaining": wickets_remaining,
        "total_overs": total_overs, "own_seq": own_history,
    })
    prediction, _ = expert_predict_player_number(player_history, ctx)

    # Aggression: how hard should the bot try to score big?
    if target is None:
        phase = 1 - (balls_remaining / max(1, total_overs * 6))
        aggression = max(0.4, min(1.0, 0.4 + 0.55 * phase + (0.2 if balls_remaining <= 18 else 0)))
    else:
        runs_needed = max(target - score, 0)
        if runs_needed <= 0:
            return 0
        rr = runs_needed / max(balls_remaining / 6, 1 / 6)
        aggression = max(0.25, min(1.0, rr / 6.0))
        if balls_remaining <= 12:
            aggression = max(aggression, min(1.0, runs_needed / max(balls_remaining, 1)))
    if wickets_remaining <= 2 and aggression < 0.9:
        aggression *= 0.72

    # Base weights: favour scoring numbers scaled by aggression
    weights = {
        0: 0.05,
        1: 0.3 + 0.1 * (1 - aggression),
        2: 0.45 + 0.1 * (1 - aggression),
        3: 0.55,
        4: 0.7 + 0.5 * aggression,
        5: 0.75 + 0.65 * aggression,
        6: 0.7 + 0.85 * aggression,
    }

    # Heavy penalty for numbers the bot predicts the player will bowl
    # (those are the danger numbers — playing them = getting out)
    ranked = sorted(prediction.items(), key=lambda x: x[1], reverse=True)
    for rank, (n, p) in enumerate(ranked):
        # Top predicted → almost certain avoidance; lower predicted → mild penalty
        danger = p * (2.5 if rank == 0 else 1.8 if rank == 1 else 1.0)
        weights[n] *= max(0.01, 1.0 - danger * 1.6)

    # If we just scored with a number and player predicted it, avoid repeating
    if own_history:
        last = own_history[-1]
        if prediction.get(last, 0) >= 0.18:
            weights[last] = max(0.005, weights.get(last, 0.01) * 0.1)

    total_w = sum(max(v, 0.005) for v in weights.values())
    return random.choices(range(7), weights=[max(weights[n], 0.005) / total_w for n in range(7)], k=1)[0]

def expert_match_context(role):
    return {
        "role": role, "score": s.score, "target": s.target,
        "balls_remaining": balls_remaining(), "wickets_remaining": wickets_remaining(),
        "total_overs": s.total_overs,
        "last_outcome": s[f"player_last_{'bat' if role == 'bat' else 'bowl'}_outcome"],
        "after_boundary": s.player_context_stats[f"{'bat' if role == 'bat' else 'bowl'}_after_boundary"],
        "after_wicket": s.player_context_stats[f"{'bat' if role == 'bat' else 'bowl'}_after_wicket"],
        "overall_seq": s.player_inputs_match,
    }

def record_player_number(role, num):
    suffix = "bat" if role == "bat" else "bowl"
    last_outcome = s[f"player_last_{suffix}_outcome"]
    if last_outcome == "boundary":
        s.player_context_stats[f"{suffix}_after_boundary"][num] += 1
    elif last_outcome == "wicket":
        s.player_context_stats[f"{suffix}_after_wicket"][num] += 1
    if s.difficulty == "Expert":
        _update_model_weights(role, num, s.expert_last_dists.get(role))
    s[f"player_{'bat' if role == 'bat' else 'bowl'}ting_history" if role == "bat" else "player_bowling_history"].append(num)
    s.player_inputs_match.append(num)

def set_player_outcome(role, outcome):
    s["player_last_bat_outcome" if role == "bat" else "player_last_bowl_outcome"] = outcome

# ── Supabase DB helpers ────────────────────────────────────────────────────────
@st.cache_data(ttl=60)
def db_load_player(username: str):
    """Load career stats for a player. Returns dict or None."""
    sb = _get_sb()
    if not sb or not username:
        return None
    try:
        r = sb.table("hc_players").select("*").eq("username", username).limit(1).execute()
        if r.data:
            return r.data[0]
        sb.table("hc_players").insert({"username": username}).execute()
        return {"username": username, "matches": 0, "wins": 0, "losses": 0, "ties": 0,
                "bat_runs": 0, "bat_balls": 0, "bat_outs": 0, "bat_hs": 0,
                "bowl_wkts": 0, "bowl_runs": 0, "bowl_balls": 0,
                "catches": 0, "runouts": 0, "stumpings": 0}
    except Exception:
        return None

def db_upsert_player_stats(username: str, won: bool, tied: bool, p: dict, bowl_wkts: int):
    """Upsert aggregate career stats after a match."""
    sb = _get_sb()
    if not sb or not username:
        return
    try:
        r = sb.table("hc_players").select("*").eq("username", username).limit(1).execute()
        ex = r.data[0] if r.data else {}
        def _a(k, v): return ex.get(k, 0) + v
        row = {
            "username":   username,
            "matches":    _a("matches", 1),
            "wins":       _a("wins",    1 if won else 0),
            "losses":     _a("losses",  1 if not won and not tied else 0),
            "ties":       _a("ties",    1 if tied else 0),
            "bat_runs":   _a("bat_runs",   p["runs"]),
            "bat_balls":  _a("bat_balls",  p["balls"]),
            "bat_outs":   _a("bat_outs",   p["outs"]),
            "bat_hs":     max(ex.get("bat_hs", 0), p["runs"]),
            "bowl_wkts":  _a("bowl_wkts",  bowl_wkts),
            "bowl_runs":  _a("bowl_runs",  p["runs_conceded"]),
            "bowl_balls": _a("bowl_balls", p["balls_bowled"]),
            "catches":    _a("catches",    p["catches"]),
            "runouts":    _a("runouts",    p["runouts"]),
            "stumpings":  _a("stumpings",  p["stumpings"]),
        }
        sb.table("hc_players").upsert(row).execute()
        db_load_player.clear()  # invalidate cache so setup screen refreshes
    except Exception:
        pass

def db_log_ball(username: str, batter_num: int, bowler_num: int, outcome: str, player_role: str):
    """Log a single ball for cross-user AI learning."""
    sb = _get_sb()
    if not sb or not username:
        return
    try:
        sb.table("hc_balls").insert({
            "username": username, "batter_num": batter_num,
            "bowler_num": bowler_num, "outcome": outcome,
            "player_role": player_role,
        }).execute()
    except Exception:
        pass

@st.cache_data(ttl=300)
def db_global_batter_nums() -> list:
    """Return list of batter_num values from all users (for Expert AI cold-start seeding)."""
    sb = _get_sb()
    if not sb:
        return []
    try:
        r = sb.table("hc_balls").select("batter_num").limit(10000).execute()
        return [row["batter_num"] for row in (r.data or [])]
    except Exception:
        return []

# ── Session state ─────────────────────────────────────────────────────────────
def init_state():
    defaults = {
        "phase": "setup",
        "player_name": "Player",
        "difficulty": "Classic",
        "total_wickets": 3,
        "total_overs": 2,
        "first_batter": None,
        "score": 0,
        "wickets_lost": 0,
        "balls_bowled": 0,
        "batter_history": [],
        "bowler_history": [],
        "target": None,
        "innings1_score": 0,
        "innings1_wickets": 0,
        "innings1_balls": 0,
        "innings1_batter": None,
        "last_event": None,
        "last_msg": "",
        "result_msg": "",
        "break_msg": "",
        "toss_result": None,
        "pending_dismissal": None,
        "dismissal_options": None,
        "input_error": False,
        "player_inputs_match": [],
        "player_batting_history": [],
        "player_bowling_history": [],
        "player_last_bat_outcome": None,
        "player_last_bowl_outcome": None,
        "player_context_stats": {
            "bat_after_boundary": Counter(), "bat_after_wicket": Counter(),
            "bowl_after_boundary": Counter(), "bowl_after_wicket": Counter(),
        },
        "expert_weights": {"bat": _new_model_weights(), "bowl": _new_model_weights()},
        "expert_last_dists": {"bat": None, "bowl": None},
        "stats": {
            "player": {"runs":0,"balls":0,"outs":0,"balls_bowled":0,"runs_conceded":0,"catches":0,"runouts":0,"stumpings":0,"bowled":0},
            "CricBot": {"runs":0,"balls":0,"outs":0,"balls_bowled":0,"runs_conceded":0,"catches":0,"runouts":0,"stumpings":0,"bowled":0}
        },
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

init_state()
s = st.session_state

def reset():
    keys = list(s.keys())
    for k in keys:
        del st.session_state[k]
    init_state()

def current_innings():
    return 1 if s.phase == "innings1" else 2

def who_is_batting():
    if s.phase == "innings1": return s.first_batter
    return "CricBot" if s.first_batter == "player" else "player"

def who_is_bowling():
    return "CricBot" if who_is_batting() == "player" else "player"

def balls_remaining():
    return s.total_overs * 6 - s.balls_bowled

def wickets_remaining():
    return s.total_wickets - s.wickets_lost

def process_ball(player_num):
    batter = who_is_batting()
    bowler = who_is_bowling()
    expert = s.difficulty == "Expert"
    if batter == "player":
        batter_num = player_num
        bowler_num = expert_bowler_choice(
            s.player_batting_history, own_history=s.bowler_history, ctx=expert_match_context("bat")
        ) if expert else ai_bowler_choice(
            s.batter_history, own_history=s.bowler_history,
            target=s.target, score=s.score, balls_remaining=balls_remaining()
        )
        record_player_number("bat", player_num)
    else:
        bowler_num = player_num
        batter_num = expert_batter_choice(
            s.player_bowling_history, own_history=s.batter_history,
            score=s.score, target=s.target,
            balls_remaining=balls_remaining(),
            wickets_remaining=wickets_remaining(),
            total_overs=s.total_overs, ctx=expert_match_context("bowl")
        ) if expert else ai_batter_choice(
            s.bowler_history, own_history=s.batter_history,
            score=s.score, target=s.target,
            balls_remaining=balls_remaining(),
            wickets_remaining=wickets_remaining(),
            total_overs=s.total_overs
        )
        record_player_number("bowl", player_num)
    s.batter_history.append(batter_num)
    s.bowler_history.append(bowler_num)
    s.balls_bowled += 1
    s.stats[batter]["balls"] += 1
    s.stats[bowler]["balls_bowled"] += 1
    if batter_num == bowler_num:
        dtype = determine_dismissal_type(batter_num, s.batter_history)
        # Expert mode: no mini-game — numbers matched = instant OUT
        if expert:
            apply_dismissal(batter, bowler, batter_num, bowler_num, dtype)
        elif dtype in ('catch_chance', 'runout_chance', 'stump_chance'):
            options = random.sample(range(0, 7), 2)   # 50/50 chance
            s.pending_dismissal = {
                "type": dtype, "batter": batter, "bowler": bowler,
                "batter_num": batter_num, "bowler_num": bowler_num,
            }
            s.dismissal_options = options
            s.last_event = "dot"
            hint = {
                "catch_chance": "🏐 Big shot! Up in the air — CATCH CHANCE!",
                "runout_chance": "🏃 Quick single! Throw's coming — RUN-OUT CHANCE!",
                "stump_chance": "🧤 Keeper's up! STUMPING CHANCE!",
            }[dtype]
            s.last_msg = f"{hint} ({batter_num} vs {bowler_num})"
            return
        else:
            apply_dismissal(batter, bowler, batter_num, bowler_num, dtype)
    else:
        runs = batter_num
        s.score += runs
        s.stats[batter]["runs"] += runs
        s.stats[bowler]["runs_conceded"] += runs
        s.last_event = "six" if runs == 6 else "runs"
        s.last_msg = f"+{runs} run{'s' if runs != 1 else ''} · ({batter_num} vs {bowler_num})"
        if batter == "player":
            set_player_outcome("bat", "boundary" if runs >= 4 else "dot" if runs == 0 else "runs")
            db_log_ball(s.player_name, batter_num, bowler_num,
                        "six" if runs==6 else "boundary" if runs>=4 else "dot" if runs==0 else "runs", "bat")
        else:
            set_player_outcome("bowl", "boundary" if runs >= 4 else "dot" if runs == 0 else "runs")
            db_log_ball(s.player_name, batter_num, bowler_num,
                        "six" if runs==6 else "boundary" if runs>=4 else "dot" if runs==0 else "runs", "bowl")
    check_innings_over()

def apply_dismissal(batter, bowler, batter_num, bowler_num, dtype):
    s.wickets_lost += 1
    s.stats[batter]["outs"] += 1
    s.stats[bowler]["bowled"] += 1
    s.last_event = "out"
    s.last_msg = f"OUT! Bowled! ({batter_num} vs {bowler_num})"
    if batter == "player":
        set_player_outcome("bat", "wicket")
        db_log_ball(s.player_name, batter_num, bowler_num, "out", "bat")
    else:
        set_player_outcome("bowl", "wicket")
        db_log_ball(s.player_name, batter_num, bowler_num, "out", "bowl")

def resolve_dismissal(player_choice):
    pd = s.pending_dismissal
    if not pd: return
    bot_choice = random.choice(s.dismissal_options)
    dtype = pd["type"]
    batter, bowler = pd["batter"], pd["bowler"]
    batter_num, bowler_num = pd["batter_num"], pd["bowler_num"]
    label = {"catch_chance": "Caught", "runout_chance": "Run Out", "stump_chance": "Stumped"}[dtype]
    stat_key = {"catch_chance": "catches", "runout_chance": "runouts", "stump_chance": "stumpings"}[dtype]
    action = {"catch_chance": "catch", "runout_chance": "run-out", "stump_chance": "stumping"}[dtype]
    player_is_fielding = (bowler == "player")
    if player_choice == bot_choice:
        s.wickets_lost += 1
        s.stats[batter]["outs"] += 1
        s.stats[bowler][stat_key] += 1
        s.last_event = "out"
        if player_is_fielding:
            s.last_msg = f"OUT! {label}! You read it — took the {action}! ({batter_num} vs {bowler_num})"
            set_player_outcome("bowl", "wicket")
            db_log_ball(s.player_name, batter_num, bowler_num, "out", "bowl")
        else:
            s.last_msg = f"OUT! {label}! You picked {player_choice}, fielder picked {bot_choice}! ({batter_num} vs {bowler_num})"
            set_player_outcome("bat", "wicket")
            db_log_ball(s.player_name, batter_num, bowler_num, "out", "bat")
    else:
        # Dropped / survived — batter SCORES the runs from that shot
        runs = batter_num
        s.score += runs
        s.stats[batter]["runs"] += runs
        s.stats[bowler]["runs_conceded"] += runs
        s.last_event = "six" if runs == 6 else "runs" if runs > 0 else "dot"
        if player_is_fielding:
            s.last_msg = f"😬 Dropped! +{runs} run{'s' if runs!=1 else ''} scored! (You picked {player_choice}, needed {bot_choice})"
            set_player_outcome("bowl", "boundary" if runs >= 4 else "dot" if runs == 0 else "runs")
        else:
            s.last_msg = f"🙌 Survived! +{runs} run{'s' if runs!=1 else ''}! (Fielder: {bot_choice}, You: {player_choice})"
            set_player_outcome("bat", "boundary" if runs >= 4 else "dot" if runs == 0 else "runs")
        db_log_ball(s.player_name, batter_num, bowler_num, "survived",
                    "bowl" if player_is_fielding else "bat")
    s.pending_dismissal = None
    s.dismissal_options = None
    check_innings_over()

def check_innings_over():
    innings_over = False
    if s.target is not None and s.score >= s.target:
        innings_over = True
    elif s.wickets_lost >= s.total_wickets or s.balls_bowled >= s.total_overs * 6:
        innings_over = True
    if innings_over:
        end_innings()

def end_innings():
    if s.phase == "innings1":
        s.innings1_score   = s.score
        s.innings1_wickets = s.wickets_lost
        s.innings1_balls   = s.balls_bowled
        s.innings1_batter  = s.first_batter
        s.target           = s.score + 1
        batter_label = s.player_name if s.first_batter == "player" else "CricBot"
        overs_str = f"{s.balls_bowled//6}.{s.balls_bowled%6}"
        s.break_msg = (f"Innings 1 complete! {batter_label} scored {s.score}/{s.wickets_lost} "
                       f"from {overs_str} overs. Target: {s.target} runs.")
        s.score = 0; s.wickets_lost = 0; s.balls_bowled = 0
        s.batter_history = []; s.bowler_history = []
        s.last_event = None; s.last_msg = ""
        s.phase = "innings_break"
    else:
        second_batter = "CricBot" if s.first_batter == "player" else "player"
        if s.score >= s.target:
            margin = s.total_wickets - s.wickets_lost
            winner = second_batter
            s.result_msg = f"{'YOU WON!' if winner == 'player' else 'CRICBOT WINS!'} by {max(margin,0)} wicket{'s' if margin!=1 else ''}"
        elif s.score == s.target - 1:
            s.result_msg = "MATCH TIED!"
        else:
            margin = s.target - s.score - 1
            winner = s.first_batter
            s.result_msg = f"{'YOU WON!' if winner == 'player' else 'CRICBOT WINS!'} by {margin} run{'s' if margin!=1 else ''}"
        # Save career stats to Supabase
        _won  = "YOU WON" in s.result_msg
        _tied = "TIED"    in s.result_msg
        _p    = s.stats["player"]
        _wkts = _p["catches"] + _p["runouts"] + _p["stumpings"] + _p["bowled"]
        db_upsert_player_stats(s.player_name, _won, _tied, _p, _wkts)
        s.phase = "result"

# ── Stat helpers ───────────────────────────────────────────────────────────────
def fmt_sr(runs, balls):
    return f"{runs/balls*100:.1f}" if balls else "—"

def fmt_avg(runs, outs):
    return f"{runs/outs:.1f}" if outs else ("—" if runs == 0 else f"{runs}*")

def fmt_bowl_avg(runs, wkts):
    return f"{runs/wkts:.1f}" if wkts else "—"

def fmt_eco(runs, balls):
    return f"{runs/(balls/6):.2f}" if balls else "—"

def fmt_bowl_sr(balls, wkts):
    return f"{balls/wkts:.1f}" if wkts else "—"

def fmt_overs(balls):
    return f"{balls//6}.{balls%6}"

# ══════════════════════════════════════════════════════════════════════════════
# UI
# ══════════════════════════════════════════════════════════════════════════════
st.markdown("""
<div class="game-title">
    <h1>🏏 HAND CRICKET</h1>
    <p>vs CricBot · Numbers 0 to 6</p>
</div>
""", unsafe_allow_html=True)
st.markdown('<hr class="divider">', unsafe_allow_html=True)

# ── SETUP ─────────────────────────────────────────────────────────────────────
if s.phase == "setup":
    st.markdown("<p class='section-label'>Player Setup</p>", unsafe_allow_html=True)
    name = st.text_input("Your name", value=s.player_name if s.player_name != "Player" else "",
                         max_chars=20, placeholder="Enter name to track career stats")
    difficulty = st.selectbox("Difficulty", ["Classic", "Expert"],
                              index=0 if s.difficulty == "Classic" else 1)
    if difficulty == "Expert":
        st.markdown("<div class='banner banner-info'>🧠 Expert: 20 overs · 10 wickets · Adaptive AI engine</div>", unsafe_allow_html=True)
    c1, c2 = st.columns(2)
    with c1:
        wickets = st.number_input("Wickets", min_value=1, max_value=10,
                                   value=10 if difficulty == "Expert" else 3,
                                   step=1, disabled=difficulty == "Expert")
    with c2:
        overs = st.number_input("Overs", min_value=1, max_value=20,
                                value=20 if difficulty == "Expert" else 2,
                                step=1, disabled=difficulty == "Expert")
    if st.button("⚡  START MATCH", use_container_width=True):
        s.player_name   = name.strip() or "Player"
        s.difficulty    = difficulty
        s.total_wickets = 10 if difficulty == "Expert" else int(wickets)
        s.total_overs   = 20 if difficulty == "Expert" else int(overs)
        s.toss_result   = random.choice(["heads", "tails"])
        s.phase         = "toss"
        st.rerun()

    # ── Career Stats Box ──────────────────────────────────────────────────────
    pname = name.strip()
    career = db_load_player(pname) if pname else None
    if career and career.get("matches", 0) > 0:
        m  = career.get("matches", 0)
        w  = career.get("wins",    0)
        l  = career.get("losses",  0)
        t  = career.get("ties",    0)
        pct = f"{w/m*100:.0f}%" if m else "—"
        br  = career.get("bat_runs",  0)
        bb  = career.get("bat_balls", 0)
        bo  = career.get("bat_outs",  0)
        bhs = career.get("bat_hs",    0)
        bwk = career.get("bowl_wkts", 0)
        bwr = career.get("bowl_runs", 0)
        bwb = career.get("bowl_balls",0)
        cat = career.get("catches",   0)
        rro = career.get("runouts",   0)
        stu = career.get("stumpings", 0)
        st.markdown(f"""
        <div class="career-box">
            <div class="career-title">📊 Career Stats</div>
            <div class="career-name">{pname}</div>
            <div class="career-pills">
                <span class="win-pill pill-w">W {w}</span>&nbsp;
                <span class="win-pill pill-l">L {l}</span>&nbsp;
                <span class="win-pill pill-t">T {t}</span>&nbsp;
                <span class="win-pill pill-pct">WIN {pct}</span>
            </div>
            <div class="career-section">🏏 Batting</div>
            <div class="stats-grid stats-grid-3">
                <div class="stat-cell"><div class="sv sv-green">{br}</div><div class="sl">Total Runs</div></div>
                <div class="stat-cell"><div class="sv sv-gold">{bhs}</div><div class="sl">High Score</div></div>
                <div class="stat-cell"><div class="sv sv-orange">{fmt_sr(br,bb)}</div><div class="sl">Strike Rate</div></div>
            </div>
            <div class="stats-grid stats-grid-3">
                <div class="stat-cell"><div class="sv sv-blue">{fmt_avg(br,bo)}</div><div class="sl">Average</div></div>
                <div class="stat-cell"><div class="sv">{bb}</div><div class="sl">Balls Faced</div></div>
                <div class="stat-cell"><div class="sv sv-red">{bo}</div><div class="sl">Wickets Lost</div></div>
            </div>
            <div class="career-section">🎳 Bowling</div>
            <div class="stats-grid stats-grid-3">
                <div class="stat-cell"><div class="sv sv-green">{bwk}</div><div class="sl">Wickets</div></div>
                <div class="stat-cell"><div class="sv sv-red">{bwr}</div><div class="sl">Runs Given</div></div>
                <div class="stat-cell"><div class="sv sv-orange">{fmt_eco(bwr,bwb)}</div><div class="sl">Economy</div></div>
            </div>
            <div class="stats-grid stats-grid-3">
                <div class="stat-cell"><div class="sv sv-blue">{fmt_bowl_avg(bwr,bwk)}</div><div class="sl">Bowl Avg</div></div>
                <div class="stat-cell"><div class="sv">{fmt_bowl_sr(bwb,bwk)}</div><div class="sl">Bowl SR</div></div>
                <div class="stat-cell"><div class="sv">{fmt_overs(bwb)}</div><div class="sl">Overs</div></div>
            </div>
            <div class="career-section">🏐 Fielding</div>
            <div class="stats-grid stats-grid-3">
                <div class="stat-cell"><div class="sv sv-gold">{cat}</div><div class="sl">Catches</div></div>
                <div class="stat-cell"><div class="sv sv-orange">{rro}</div><div class="sl">Run Outs</div></div>
                <div class="stat-cell"><div class="sv sv-blue">{stu}</div><div class="sl">Stumpings</div></div>
            </div>
        </div>
        """, unsafe_allow_html=True)
    elif pname and _get_sb():
        st.markdown("<p class='no-stats'>No career stats yet — play a match to start tracking!</p>",
                    unsafe_allow_html=True)
    elif not _get_sb():
        pass  # Supabase not configured — stats silently disabled

# ── TOSS ──────────────────────────────────────────────────────────────────────
elif s.phase == "toss":
    st.markdown("<div class='banner banner-info'>🪙 COIN TOSS — Call it!</div>", unsafe_allow_html=True)
    c1, c2 = st.columns(2)
    with c1:
        st.markdown("<div class='btn-toss'>", unsafe_allow_html=True)
        if st.button("⬆ HEADS", use_container_width=True):
            call = "heads"
            if call == s.toss_result:
                s.last_msg = f"It's {s.toss_result.upper()}! You won — choose bat or bowl."
                s.phase = "toss_choice"
            else:
                s.last_msg = f"It's {s.toss_result.upper()}! You lost the toss."
                cricbot = random.choice(["bat", "bowl"])
                s.first_batter = "CricBot" if cricbot == "bat" else "player"
                s.phase = "innings1"
            st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)
    with c2:
        st.markdown("<div class='btn-toss'>", unsafe_allow_html=True)
        if st.button("⬇ TAILS", use_container_width=True):
            call = "tails"
            if call == s.toss_result:
                s.last_msg = f"It's {s.toss_result.upper()}! You won — choose bat or bowl."
                s.phase = "toss_choice"
            else:
                s.last_msg = f"It's {s.toss_result.upper()}! You lost the toss."
                cricbot = random.choice(["bat", "bowl"])
                s.first_batter = "CricBot" if cricbot == "bat" else "player"
                s.phase = "innings1"
            st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)

# ── TOSS CHOICE ───────────────────────────────────────────────────────────────
elif s.phase == "toss_choice":
    st.markdown(f"<div class='banner banner-runs'>{s.last_msg}</div>", unsafe_allow_html=True)
    st.markdown("<p class='section-label'>Choose your role</p>", unsafe_allow_html=True)
    c1, c2 = st.columns(2)
    with c1:
        if st.button("🏏  BAT FIRST", use_container_width=True):
            s.first_batter = "player"; s.phase = "innings1"; st.rerun()
    with c2:
        if st.button("🎳  BOWL FIRST", use_container_width=True):
            s.first_batter = "CricBot"; s.phase = "innings1"; st.rerun()

# ── INNINGS BREAK ─────────────────────────────────────────────────────────────
elif s.phase == "innings_break":
    st.markdown(f"<div class='banner banner-target'>🏁 {s.break_msg}</div>", unsafe_allow_html=True)

    # show innings 1 stats
    i1_batter = s.player_name if s.innings1_batter == "player" else "CricBot"
    i1_bowler = "CricBot" if s.innings1_batter == "player" else s.player_name
    st.markdown(f"<p class='stats-section-label'>Innings 1 — {i1_batter} batted</p>", unsafe_allow_html=True)

    p = s.stats["player"]; c = s.stats["CricBot"]
    if s.innings1_batter == "player":
        b_runs, b_balls, b_outs = p["runs"], p["balls"], p["outs"]
        bwl_runs, bwl_balls, bwl_wkts = c["runs_conceded"], c["balls_bowled"], p["outs"]
    else:
        b_runs, b_balls, b_outs = c["runs"], c["balls"], c["outs"]
        bwl_runs, bwl_balls, bwl_wkts = p["runs_conceded"], p["balls_bowled"], c["outs"]

    st.markdown(f"""
    <div class="stats-grid stats-grid-3">
        <div class="stat-cell"><div class="sv sv-green">{b_runs}</div><div class="sl">Runs</div></div>
        <div class="stat-cell"><div class="sv">{b_balls}</div><div class="sl">Balls</div></div>
        <div class="stat-cell"><div class="sv sv-red">{b_outs}</div><div class="sl">Wickets</div></div>
    </div>
    <div class="stats-grid stats-grid-3">
        <div class="stat-cell"><div class="sv sv-orange">{fmt_sr(b_runs, b_balls)}</div><div class="sl">Strike Rate</div></div>
        <div class="stat-cell"><div class="sv">{fmt_overs(s.innings1_balls)}/{s.total_overs}</div><div class="sl">Overs</div></div>
        <div class="stat-cell"><div class="sv sv-blue">{fmt_avg(b_runs, b_outs)}</div><div class="sl">Avg/Wkt</div></div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown('<hr class="stats-divider">', unsafe_allow_html=True)
    st.markdown(f"<p class='stats-section-label'>Innings 2 — {i1_bowler} to bat · Target: {s.target}</p>", unsafe_allow_html=True)
    if st.button("▶  START INNINGS 2", use_container_width=True):
        s.phase = "innings2"
        st.rerun()

# ── INNINGS 1 & 2 ─────────────────────────────────────────────────────────────
elif s.phase in ("innings1", "innings2"):
    batter  = who_is_batting()
    bowler  = who_is_bowling()
    inn_num = current_innings()
    batter_label = s.player_name if batter == "player" else "CricBot"
    bowler_label = s.player_name if bowler == "player" else "CricBot"
    player_is_batting = (batter == "player")

    # ── Top info bar
    diff_badge = "🧠 Expert" if s.difficulty == "Expert" else "⚙ Classic"
    role_class = "role-bat" if player_is_batting else "role-bowl"
    role_text  = f"{'🏏 BATTING' if player_is_batting else '🎳 BOWLING'}"
    st.markdown(f"""
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">
        <span style="font-size:0.62rem;color:#333355;font-family:'Space Mono',monospace;">{diff_badge} · Inn {inn_num} · {s.total_overs}ov/{s.total_wickets}wk</span>
        <span class="role-badge {role_class}">{role_text}</span>
    </div>
    """, unsafe_allow_html=True)

    # ── Target bar (innings 2)
    if s.target:
        needed = s.target - s.score
        br = balls_remaining()
        rr = (needed / (br / 6)) if br > 0 else 0
        st.markdown(f"""
        <div class='banner banner-target'>
            🎯 Target: {s.target} &nbsp;·&nbsp; Need <b>{needed}</b> from <b>{br}</b> ball{'s' if br!=1 else ''} &nbsp;·&nbsp; RRR: {rr:.1f}
        </div>
        """, unsafe_allow_html=True)

    # ── Main scoreboard
    overs_str = f"{s.balls_bowled//6}.{s.balls_bowled%6}"
    col1, col2 = st.columns([3, 2])
    with col1:
        st.markdown(f"""
        <div class='scoreboard-main'>
            <div class='inn-label'>Innings {inn_num} · {batter_label} batting</div>
            <div class='score-big'>{s.score}<span style="font-size:1.2rem;color:#444466">/{s.wickets_lost}</span></div>
            <div class='score-overs'>{overs_str} / {s.total_overs} overs</div>
        </div>
        """, unsafe_allow_html=True)
    with col2:
        if inn_num == 2:
            st.markdown(f"""
            <div class='scoreboard-side'>
                <div class='inn-label'>Inn 1 Score</div>
                <div class='score-mid'>{s.innings1_score}/{s.innings1_wickets}</div>
                <div class='score-sub'>{fmt_overs(s.innings1_balls)} ov</div>
            </div>
            """, unsafe_allow_html=True)
        else:
            wk_rem = wickets_remaining()
            b_rem  = balls_remaining()
            st.markdown(f"""
            <div class='scoreboard-side'>
                <div class='inn-label'>Remaining</div>
                <div class='score-mid' style='color:{"#ff3366" if wk_rem <= 2 else "#818cf8"}'>{wk_rem} wkt{"s" if wk_rem!=1 else ""}</div>
                <div class='score-sub'>{b_rem} ball{"s" if b_rem!=1 else ""} left</div>
            </div>
            """, unsafe_allow_html=True)

    # ── Live comprehensive stats
    balls  = s.balls_bowled
    runs   = s.score
    wkts   = s.wickets_lost
    br     = balls_remaining()
    wr     = wickets_remaining()
    sr_val = fmt_sr(runs, balls)
    avg_val= fmt_avg(runs, wkts)
    eco_val= fmt_eco(runs, balls)
    bsr_val= fmt_bowl_sr(balls, wkts)   # bowling SR = balls per wicket

    if player_is_batting:
        st.markdown(f"""
        <div class="stats-grid stats-grid-3">
            <div class="stat-cell"><div class="sv sv-green">{runs}</div><div class="sl">Runs</div></div>
            <div class="stat-cell"><div class="sv">{balls}</div><div class="sl">Balls Faced</div></div>
            <div class="stat-cell"><div class="sv sv-red">{wkts}</div><div class="sl">Wickets</div></div>
        </div>
        <div class="stats-grid stats-grid-3">
            <div class="stat-cell"><div class="sv sv-orange">{sr_val}</div><div class="sl">Strike Rate</div></div>
            <div class="stat-cell"><div class="sv">{overs_str}/{s.total_overs}</div><div class="sl">Overs</div></div>
            <div class="stat-cell"><div class="sv sv-blue">{avg_val}</div><div class="sl">Avg/Wkt</div></div>
        </div>
        """, unsafe_allow_html=True)
    else:
        # player bowling — show bowling perspective
        st.markdown(f"""
        <div class="stats-grid stats-grid-3">
            <div class="stat-cell"><div class="sv sv-green">{wkts}</div><div class="sl">Wkts Taken</div></div>
            <div class="stat-cell"><div class="sv sv-red">{runs}</div><div class="sl">Runs Conceded</div></div>
            <div class="stat-cell"><div class="sv">{overs_str}/{s.total_overs}</div><div class="sl">Overs</div></div>
        </div>
        <div class="stats-grid stats-grid-3">
            <div class="stat-cell"><div class="sv sv-orange">{eco_val}</div><div class="sl">Economy</div></div>
            <div class="stat-cell"><div class="sv sv-blue">{fmt_bowl_avg(runs, wkts)}</div><div class="sl">Bowl Avg</div></div>
            <div class="stat-cell"><div class="sv">{bsr_val}</div><div class="sl">Bowl SR</div></div>
        </div>
        """, unsafe_allow_html=True)

    # ── Last event banner
    if s.last_msg:
        ev = s.last_event or "info"
        if ev == "out":     css = "banner-out"
        elif ev == "six":   css = "banner-six"
        elif ev == "runs":  css = "banner-runs"
        elif ev in ("survived", "dot"): css = "banner-dot"
        else:               css = "banner-info"
        st.markdown(f"<div class='banner {css}'>{s.last_msg}</div>", unsafe_allow_html=True)
    else:
        action = "batting shot" if player_is_batting else "bowling number"
        st.markdown(f"<div class='banner banner-info'>Pick your {action} — press a number below</div>", unsafe_allow_html=True)

    st.markdown('<hr class="divider">', unsafe_allow_html=True)

    # ── INPUT AREA ────────────────────────────────────────────────────────────
    if s.pending_dismissal:
        # Dismissal mini-game
        player_is_fielding = s.pending_dismissal["bowler"] == "player"
        if player_is_fielding:
            hints = {
                "catch_chance":  "🏐 CATCH CHANCE — pick a number to complete the catch!",
                "runout_chance": "🏃 RUN-OUT CHANCE — pick the throw number!",
                "stump_chance":  "🧤 STUMPING CHANCE — whip off the bails!",
            }
        else:
            hints = {
                "catch_chance":  "🏐 CATCH CHANCE — match the fielder to survive!",
                "runout_chance": "🏃 RUN-OUT CHANCE — dodge the throw!",
                "stump_chance":  "🧤 STUMPING CHANCE — fool the keeper!",
            }
        st.markdown(f"<p class='catch-hint'>{hints[s.pending_dismissal['type']]}</p>", unsafe_allow_html=True)
        cols = st.columns(2)
        for i, opt in enumerate(s.dismissal_options):
            with cols[i]:
                if st.button(str(opt), key=f"dismiss_{s.balls_bowled}_{opt}", use_container_width=True):
                    resolve_dismissal(opt)
                    st.rerun()

    else:
        # ── NUMBER INPUT ──────────────────────────────────────────────────────
        action_lbl = "YOUR SHOT" if player_is_batting else "YOUR BALL"
        st.markdown(f"<p class='section-label'>{action_lbl} · ENTER 0 – 6</p>", unsafe_allow_html=True)
        with st.form(key=f"ball_form_{s.balls_bowled}", clear_on_submit=True):
            user_val = st.text_input(
                "number", key="ball_num_input",
                label_visibility="collapsed",
                placeholder="0 – 6",
                max_chars=1,
            )
            btn_label = "⚡ BAT" if player_is_batting else "⚡ BOWL"
            submitted = st.form_submit_button(btn_label, use_container_width=True)
        if submitted:
            val = (user_val or "").strip()
            if val.isdigit() and 0 <= int(val) <= 6:
                s.input_error = False
                process_ball(int(val))
                st.rerun()
            else:
                s.input_error = True
        if s.input_error:
            st.markdown(
                "<p style='text-align:center;color:#ff3366;font-size:0.8rem;"
                "font-family:Space Mono,monospace;margin-top:-0.4rem;'>"
                "⚠ Enter a number between 0 and 6</p>",
                unsafe_allow_html=True
            )

    # ── Quick reset link
    st.markdown('<hr class="divider">', unsafe_allow_html=True)
    if st.button("↩ Quit Match", use_container_width=False):
        reset(); st.rerun()

# ── RESULT ────────────────────────────────────────────────────────────────────
elif s.phase == "result":
    msg = s.result_msg
    if "YOU WON" in msg:   css = "banner-win"
    elif "TIED" in msg:    css = "banner-tie"
    else:                  css = "banner-lose"
    st.markdown(f"<div class='banner {css}'>{msg}</div>", unsafe_allow_html=True)
    st.markdown('<hr class="divider">', unsafe_allow_html=True)

    p = s.stats["player"]
    c = s.stats["CricBot"]

    # ── Batting stats comparison
    st.markdown("<p class='result-header'>⚔ BATTING</p>", unsafe_allow_html=True)
    col1, col2 = st.columns(2)
    with col1:
        st.markdown(f"<div class='player-name-label lbl-player'>{s.player_name}</div>", unsafe_allow_html=True)
        st.markdown(f"""
        <div class="stats-grid stats-grid-2">
            <div class="stat-cell"><div class="sv sv-green">{p['runs']}</div><div class="sl">Runs</div></div>
            <div class="stat-cell"><div class="sv">{p['balls']}</div><div class="sl">Balls</div></div>
            <div class="stat-cell"><div class="sv sv-red">{p['outs']}</div><div class="sl">Wickets</div></div>
            <div class="stat-cell"><div class="sv sv-orange">{fmt_sr(p['runs'], p['balls'])}</div><div class="sl">Strike Rate</div></div>
        </div>
        <div class="stats-grid stats-grid-2">
            <div class="stat-cell"><div class="sv sv-blue">{fmt_avg(p['runs'], p['outs'])}</div><div class="sl">Average</div></div>
            <div class="stat-cell"><div class="sv">{fmt_overs(p['balls'])}</div><div class="sl">Overs Batted</div></div>
        </div>
        """, unsafe_allow_html=True)
    with col2:
        st.markdown(f"<div class='player-name-label lbl-bot'>CricBot</div>", unsafe_allow_html=True)
        st.markdown(f"""
        <div class="stats-grid stats-grid-2">
            <div class="stat-cell"><div class="sv sv-green">{c['runs']}</div><div class="sl">Runs</div></div>
            <div class="stat-cell"><div class="sv">{c['balls']}</div><div class="sl">Balls</div></div>
            <div class="stat-cell"><div class="sv sv-red">{c['outs']}</div><div class="sl">Wickets</div></div>
            <div class="stat-cell"><div class="sv sv-orange">{fmt_sr(c['runs'], c['balls'])}</div><div class="sl">Strike Rate</div></div>
        </div>
        <div class="stats-grid stats-grid-2">
            <div class="stat-cell"><div class="sv sv-blue">{fmt_avg(c['runs'], c['outs'])}</div><div class="sl">Average</div></div>
            <div class="stat-cell"><div class="sv">{fmt_overs(c['balls'])}</div><div class="sl">Overs Batted</div></div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown('<hr class="stats-divider">', unsafe_allow_html=True)

    # ── Bowling stats comparison
    # Player's bowling: runs_conceded by player, wickets = CricBot's outs
    # CricBot's bowling: runs_conceded by CricBot, wickets = Player's outs
    p_bowl_wkts = p["catches"] + p["runouts"] + p["stumpings"] + p["bowled"]
    c_bowl_wkts = c["catches"] + c["runouts"] + c["stumpings"] + c["bowled"]

    st.markdown("<p class='result-header'>🎳 BOWLING</p>", unsafe_allow_html=True)
    col1, col2 = st.columns(2)
    with col1:
        st.markdown(f"<div class='player-name-label lbl-player'>{s.player_name}</div>", unsafe_allow_html=True)
        st.markdown(f"""
        <div class="stats-grid stats-grid-2">
            <div class="stat-cell"><div class="sv sv-green">{p_bowl_wkts}</div><div class="sl">Wickets</div></div>
            <div class="stat-cell"><div class="sv sv-red">{p['runs_conceded']}</div><div class="sl">Runs Given</div></div>
            <div class="stat-cell"><div class="sv sv-orange">{fmt_eco(p['runs_conceded'], p['balls_bowled'])}</div><div class="sl">Economy</div></div>
            <div class="stat-cell"><div class="sv">{fmt_overs(p['balls_bowled'])}</div><div class="sl">Overs</div></div>
        </div>
        <div class="stats-grid stats-grid-2">
            <div class="stat-cell"><div class="sv sv-blue">{fmt_bowl_avg(p['runs_conceded'], p_bowl_wkts)}</div><div class="sl">Bowl Avg</div></div>
            <div class="stat-cell"><div class="sv">{fmt_bowl_sr(p['balls_bowled'], p_bowl_wkts)}</div><div class="sl">Bowl SR</div></div>
        </div>
        """, unsafe_allow_html=True)
    with col2:
        st.markdown(f"<div class='player-name-label lbl-bot'>CricBot</div>", unsafe_allow_html=True)
        st.markdown(f"""
        <div class="stats-grid stats-grid-2">
            <div class="stat-cell"><div class="sv sv-green">{c_bowl_wkts}</div><div class="sl">Wickets</div></div>
            <div class="stat-cell"><div class="sv sv-red">{c['runs_conceded']}</div><div class="sl">Runs Given</div></div>
            <div class="stat-cell"><div class="sv sv-orange">{fmt_eco(c['runs_conceded'], c['balls_bowled'])}</div><div class="sl">Economy</div></div>
            <div class="stat-cell"><div class="sv">{fmt_overs(c['balls_bowled'])}</div><div class="sl">Overs</div></div>
        </div>
        <div class="stats-grid stats-grid-2">
            <div class="stat-cell"><div class="sv sv-blue">{fmt_bowl_avg(c['runs_conceded'], c_bowl_wkts)}</div><div class="sl">Bowl Avg</div></div>
            <div class="stat-cell"><div class="sv">{fmt_bowl_sr(c['balls_bowled'], c_bowl_wkts)}</div><div class="sl">Bowl SR</div></div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown('<hr class="stats-divider">', unsafe_allow_html=True)

    # ── Fielding extras
    total_catches  = p["catches"] + c["catches"]
    total_runouts  = p["runouts"] + c["runouts"]
    total_stumpings= p["stumpings"] + c["stumpings"]
    if total_catches + total_runouts + total_stumpings > 0:
        st.markdown("<p class='result-header'>🏐 FIELDING</p>", unsafe_allow_html=True)
        st.markdown(f"""
        <div class="stats-grid stats-grid-3">
            <div class="stat-cell">
                <div class="sv sv-gold">{p['catches']}<span style='font-size:0.7rem;color:#666'> / {c['catches']}</span></div>
                <div class="sl">Catches (You/Bot)</div>
            </div>
            <div class="stat-cell">
                <div class="sv sv-orange">{p['runouts']}<span style='font-size:0.7rem;color:#666'> / {c['runouts']}</span></div>
                <div class="sl">Run Outs</div>
            </div>
            <div class="stat-cell">
                <div class="sv sv-blue">{p['stumpings']}<span style='font-size:0.7rem;color:#666'> / {c['stumpings']}</span></div>
                <div class="sl">Stumpings</div>
            </div>
        </div>
        """, unsafe_allow_html=True)
        st.markdown('<hr class="stats-divider">', unsafe_allow_html=True)

    if st.button("⚡  PLAY AGAIN", use_container_width=True):
        reset()
        st.rerun()

st.markdown('<div class="footer">HAND CRICKET · made by AhaD</div>', unsafe_allow_html=True)
