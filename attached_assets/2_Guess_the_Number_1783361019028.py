import random
import streamlit as st

st.set_page_config(page_title="Guess the Number", page_icon="🔢", layout="centered")

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

.page-title { text-align: center; padding: 1rem 0 0.5rem 0; }
.page-title h2 {
    font-family: 'Space Mono', monospace;
    font-size: 1.3rem;
    color: #fff;
    margin: 0;
    letter-spacing: -0.02em;
}
.page-title p { font-size: 0.75rem; color: #444; margin: 0.2rem 0 0 0; }

.divider { border: none; border-top: 1px solid #1e1e1e; margin: 0.9rem 0; }

/* Big number display */
.number-stage {
    text-align: center;
    margin: 1rem 0;
}
.number-stage .digit {
    font-family: 'Space Mono', monospace;
    font-size: 4rem;
    font-weight: 700;
    line-height: 1;
    color: #f0f0f0;
}
.number-stage .sub {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #555;
    margin-top: 0.3rem;
}

/* Hint banner */
.hint-banner {
    text-align: center;
    padding: 0.9rem 1rem;
    border-radius: 12px;
    margin: 0.8rem 0;
    font-family: 'Space Mono', monospace;
    font-size: 1.15rem;
    font-weight: 700;
}
.hint-high { background: #450a0a; color: #f87171; border: 1px solid #f87171; }
.hint-low  { background: #1e1b4b; color: #818cf8; border: 1px solid #818cf8; }
.hint-win  { background: #14532d; color: #4ade80; border: 1px solid #4ade80; }
.hint-idle { background: #1a1a1a; color: #444; border: 1px solid #222; font-size: 0.9rem; letter-spacing: 0.05em; }
.hint-err  { background: #422006; color: #facc15; border: 1px solid #facc15; }

/* Stat cards */
.score-board { display: flex; justify-content: center; gap: 1rem; margin: 0.8rem 0; }
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
.sc-attempts .s-value { color: #818cf8; }
.sc-range    .s-value { color: #facc15; font-size: 1.3rem; }
.sc-games    .s-value { color: #4ade80; }

/* Input + buttons */
div[data-testid="stNumberInput"] input {
    background: #161616 !important;
    color: #f0f0f0 !important;
    border: 2px solid #2a2a2a !important;
    border-radius: 12px !important;
    font-family: 'Space Mono', monospace !important;
    font-size: 1.1rem !important;
    text-align: center !important;
}
div[data-testid="stButton"] > button {
    background: #161616 !important;
    color: #f0f0f0 !important;
    border: 2px solid #2a2a2a !important;
    border-radius: 14px !important;
    font-family: 'Space Grotesk', sans-serif !important;
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

.footer {
    text-align: center;
    margin-top: 1rem;
    font-size: 0.7rem;
    color: #333;
    letter-spacing: 0.06em;
}
</style>
""", unsafe_allow_html=True)

# ── Session state ──────────────────────────────────────────────────────────────
defaults = {
    "computer": random.randint(1, 100),
    "attempts": 0,
    "games_played": 0,
    "last_guess": None,
    "status": "idle",       # idle | high | low | win | error
    "won": False,
}
for k, v in defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v

# ── Game logic (your original logic) ────────────────────────────────────────────
def submit_guess(value):
    if value > 100:
        st.session_state.status = "error_high"
        return
    if value < 1:
        st.session_state.status = "error_low"
        return

    st.session_state.attempts += 1
    st.session_state.last_guess = value

    if value > st.session_state.computer:
        st.session_state.status = "high"
    elif value < st.session_state.computer:
        st.session_state.status = "low"
    else:
        st.session_state.status = "win"
        st.session_state.won = True
        st.session_state.games_played += 1

def new_game():
    st.session_state.computer = random.randint(1, 100)
    st.session_state.attempts = 0
    st.session_state.last_guess = None
    st.session_state.status = "idle"
    st.session_state.won = False

# ── UI ─────────────────────────────────────────────────────────────────────────

st.markdown("""
<div class="page-title">
    <h2>🔢 Guess the Number</h2>
    <p>I'm thinking of a number between 1 and 100</p>
</div>
""", unsafe_allow_html=True)

st.markdown('<hr class="divider">', unsafe_allow_html=True)

# ── 1. Last guess display ──────────────────────────────────────────────────────
guess_display = st.session_state.last_guess if st.session_state.last_guess is not None else "—"
st.markdown(f"""
<div class="number-stage">
    <div class="digit">{guess_display}</div>
    <div class="sub">your last guess</div>
</div>
""", unsafe_allow_html=True)

# ── 2. Hint / result banner ────────────────────────────────────────────────────
status = st.session_state.status
if status == "idle":
    st.markdown('<div class="hint-banner hint-idle">make your first guess</div>', unsafe_allow_html=True)
elif status == "high":
    st.markdown('<div class="hint-banner hint-high">📉 Too High</div>', unsafe_allow_html=True)
elif status == "low":
    st.markdown('<div class="hint-banner hint-low">📈 Too Low</div>', unsafe_allow_html=True)
elif status == "win":
    st.markdown(f'<div class="hint-banner hint-win">🎉 Correct in {st.session_state.attempts} attempts!</div>', unsafe_allow_html=True)
elif status == "error_high":
    st.markdown('<div class="hint-banner hint-err">⚠️ Cannot be greater than 100</div>', unsafe_allow_html=True)
elif status == "error_low":
    st.markdown('<div class="hint-banner hint-err">⚠️ Cannot be less than 1</div>', unsafe_allow_html=True)

st.markdown('<hr class="divider">', unsafe_allow_html=True)

# ── 3. Input + guess / new game ────────────────────────────────────────────────
if not st.session_state.won:
    with st.form(key="guess_form", clear_on_submit=True):
        value = st.number_input("Enter your guess", min_value=0, max_value=1000, step=1, label_visibility="collapsed")
        submitted = st.form_submit_button("Guess", use_container_width=True)
        if submitted:
            submit_guess(int(value))
            st.rerun()
else:
    if st.button("🔁 Play Again", use_container_width=True):
        new_game()
        st.rerun()

st.markdown('<hr class="divider">', unsafe_allow_html=True)

# ── 4. Stats ────────────────────────────────────────────────────────────────────
st.markdown(f"""
<div class="score-board">
    <div class="score-card sc-attempts">
        <div class="s-label">Attempts</div>
        <div class="s-value">{st.session_state.attempts}</div>
    </div>
    <div class="score-card sc-range">
        <div class="s-label">Range</div>
        <div class="s-value">1–100</div>
    </div>
    <div class="score-card sc-games">
        <div class="s-label">Games Won</div>
        <div class="s-value">{st.session_state.games_played}</div>
    </div>
</div>
""", unsafe_allow_html=True)

# ── Footer ─────────────────────────────────────────────────────────────────────
st.markdown('<div class="footer">made by AhaD</div>', unsafe_allow_html=True)
