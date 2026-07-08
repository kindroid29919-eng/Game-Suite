import random
import streamlit as st

st.set_page_config(page_title="Rock Paper Scissors", page_icon="✊", layout="centered")

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap');

html, body, [class*="css"] {
    font-family: 'Space Grotesk', sans-serif;
    background-color: #0d0d0d;
    color: #f0f0f0;
}
.stApp { background: #0d0d0d; }
[data-testid="stSidebar"] { background: #111; border-right: 1px solid #1e1e1e; }

/* ── Battle arena ── */
.battle-arena {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1.2rem;
    margin: 1.2rem 0 0.4rem 0;
}
.fighter {
    text-align: center;
    flex: 1;
}
.fighter .emoji {
    font-size: 5.5rem;
    line-height: 1.1;
    display: block;
}
.fighter .who {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #555;
    margin-top: 0.3rem;
}
.fighter .move-name {
    font-family: 'Space Mono', monospace;
    font-size: 0.85rem;
    color: #aaa;
    margin-top: 0.15rem;
}
.vs-badge {
    font-family: 'Space Mono', monospace;
    font-size: 0.9rem;
    color: #444;
    padding: 0.4rem 0.7rem;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    flex-shrink: 0;
}

/* ── Result banner ── */
.result-banner {
    text-align: center;
    padding: 0.9rem 1rem;
    border-radius: 12px;
    margin: 0.8rem 0;
    font-family: 'Space Mono', monospace;
    font-size: 1.3rem;
    font-weight: 700;
}
.result-win  { background: #14532d; color: #4ade80; border: 1px solid #4ade80; }
.result-lose { background: #450a0a; color: #f87171; border: 1px solid #f87171; }
.result-tie  { background: #422006; color: #facc15; border: 1px solid #facc15; }
.result-idle {
    background: #1a1a1a;
    color: #444;
    border: 1px solid #222;
    font-size: 0.9rem;
    letter-spacing: 0.05em;
}

/* ── Divider ── */
.divider {
    border: none;
    border-top: 1px solid #1e1e1e;
    margin: 0.9rem 0;
}

/* ── Choose label ── */
.choose-label {
    text-align: center;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #555;
    margin-bottom: 0.6rem;
}

/* ── Streamlit button overrides ── */
div[data-testid="stButton"] > button {
    background: #161616 !important;
    color: #f0f0f0 !important;
    border: 2px solid #2a2a2a !important;
    border-radius: 14px !important;
    font-family: 'Space Grotesk', sans-serif !important;
    font-size: 0.85rem !important;
    font-weight: 600 !important;
    padding: 0.7rem 0.5rem !important;
    transition: all 0.15s ease !important;
    width: 100% !important;
}
div[data-testid="stButton"] > button:hover {
    border-color: #ffffff !important;
    background: #202020 !important;
    transform: translateY(-2px);
}

/* ── Score board ── */
.score-board {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin: 0.8rem 0;
}
.score-card {
    background: #161616;
    border: 1px solid #222;
    border-radius: 10px;
    padding: 0.7rem 1.2rem;
    text-align: center;
    flex: 1;
}
.score-card .s-label {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #555;
    margin-bottom: 0.2rem;
}
.score-card .s-value {
    font-family: 'Space Mono', monospace;
    font-size: 1.8rem;
    font-weight: 700;
    line-height: 1;
}
.sc-win  .s-value { color: #4ade80; }
.sc-lose .s-value { color: #f87171; }
.sc-tie  .s-value { color: #facc15; }

/* ── Footer ── */
.footer {
    text-align: center;
    margin-top: 1rem;
    font-size: 0.7rem;
    color: #333;
    letter-spacing: 0.06em;
}

/* ── Page title ── */
.page-title {
    text-align: center;
    padding: 1rem 0 0.5rem 0;
}
.page-title h2 {
    font-family: 'Space Mono', monospace;
    font-size: 1.3rem;
    color: #fff;
    margin: 0;
    letter-spacing: -0.02em;
}
.page-title p {
    font-size: 0.75rem;
    color: #444;
    margin: 0.2rem 0 0 0;
}
</style>
""", unsafe_allow_html=True)

# ── Session state ──────────────────────────────────────────────────────────────
for key, default in [("wins", 0), ("losses", 0), ("ties", 0),
                     ("last_player", None), ("last_computer", None), ("last_result", None)]:
    if key not in st.session_state:
        st.session_state[key] = default

# ── Game logic (your original logic) ──────────────────────────────────────────
CHOICES = ["rock", "paper", "scissors"]
EMOJI   = {"rock": "✊", "paper": "🖐️", "scissors": "✌️"}

def play(player: str):
    computer = random.choice(CHOICES)
    if player == computer:
        st.session_state.ties += 1; result = "tie"
    elif player == "rock":
        if computer == "scissors": st.session_state.wins += 1;   result = "win"
        else:                      st.session_state.losses += 1; result = "lose"
    elif player == "scissors":
        if computer == "rock":     st.session_state.losses += 1; result = "lose"
        else:                      st.session_state.wins += 1;   result = "win"
    elif player == "paper":
        if computer == "rock":     st.session_state.wins += 1;   result = "win"
        else:                      st.session_state.losses += 1; result = "lose"
    st.session_state.last_player   = player
    st.session_state.last_computer = computer
    st.session_state.last_result   = result

# ── UI ─────────────────────────────────────────────────────────────────────────

# Title
st.markdown("""
<div class="page-title">
    <h2>✊ Rock Paper Scissors ✌️</h2>
    <p>tap your move below</p>
</div>
""", unsafe_allow_html=True)

st.markdown('<hr class="divider">', unsafe_allow_html=True)

# ── 1. Battle display ──────────────────────────────────────────────────────────
p = st.session_state.last_player
c = st.session_state.last_computer

p_emoji = EMOJI[p] if p else "❓"
c_emoji = EMOJI[c] if c else "❓"
p_name  = p.capitalize() if p else "—"
c_name  = c.capitalize() if c else "—"

st.markdown(f"""
<div class="battle-arena">
    <div class="fighter">
        <span class="emoji">{p_emoji}</span>
        <div class="who">You</div>
        <div class="move-name">{p_name}</div>
    </div>
    <div class="vs-badge">VS</div>
    <div class="fighter">
        <span class="emoji">{c_emoji}</span>
        <div class="who">Computer</div>
        <div class="move-name">{c_name}</div>
    </div>
</div>
""", unsafe_allow_html=True)

# ── 2. Result banner ───────────────────────────────────────────────────────────
r = st.session_state.last_result
if r:
    css   = {"win": "result-win", "lose": "result-lose", "tie": "result-tie"}[r]
    label = {"win": "🏆 You Won!", "lose": "💀 You Lost!", "tie": "🤝 It's a Tie!"}[r]
    st.markdown(f'<div class="result-banner {css}">{label}</div>', unsafe_allow_html=True)
else:
    st.markdown('<div class="result-banner result-idle">make your move</div>', unsafe_allow_html=True)

st.markdown('<hr class="divider">', unsafe_allow_html=True)

# ── 3. Choice buttons ──────────────────────────────────────────────────────────
st.markdown('<div class="choose-label">Choose your move</div>', unsafe_allow_html=True)

col1, col2, col3 = st.columns(3)
with col1:
    if st.button("✊\nRock", use_container_width=True):
        play("rock"); st.rerun()
with col2:
    if st.button("🖐️\nPaper", use_container_width=True):
        play("paper"); st.rerun()
with col3:
    if st.button("✌️\nScissors", use_container_width=True):
        play("scissors"); st.rerun()

st.markdown('<hr class="divider">', unsafe_allow_html=True)

# ── 4. Score board ─────────────────────────────────────────────────────────────
st.markdown(f"""
<div class="score-board">
    <div class="score-card sc-win">
        <div class="s-label">Wins</div>
        <div class="s-value">{st.session_state.wins}</div>
    </div>
    <div class="score-card sc-lose">
        <div class="s-label">Losses</div>
        <div class="s-value">{st.session_state.losses}</div>
    </div>
    <div class="score-card sc-tie">
        <div class="s-label">Ties</div>
        <div class="s-value">{st.session_state.ties}</div>
    </div>
</div>
""", unsafe_allow_html=True)

# Reset
col_a, col_b, col_c = st.columns([2,1,2])
with col_b:
    if st.button("Reset", use_container_width=True):
        for k in ["wins","losses","ties","last_player","last_computer","last_result"]:
            st.session_state[k] = 0 if k in ["wins","losses","ties"] else None
        st.rerun()

# ── Footer ─────────────────────────────────────────────────────────────────────
st.markdown('<div class="footer">made by AhaD</div>', unsafe_allow_html=True)
