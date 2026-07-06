import streamlit as st

st.set_page_config(page_title="AhaD's Project Hub", page_icon="🎮", layout="centered")

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap');

html, body, [class*="css"] {
    font-family: 'Space Grotesk', sans-serif;
    background-color: #0d0d0d;
    color: #f0f0f0;
}
.stApp { background: #0d0d0d; }

[data-testid="stSidebar"] {
    background: #111;
    border-right: 1px solid #1e1e1e;
}

.page-title { text-align: center; padding: 1.5rem 0 0.5rem 0; }
.page-title h1 {
    font-family: 'Space Mono', monospace;
    font-size: 1.8rem;
    color: #fff;
    margin: 0;
    letter-spacing: -0.02em;
}
.page-title p { font-size: 0.85rem; color: #555; margin: 0.3rem 0 0 0; }

.divider { border: none; border-top: 1px solid #1e1e1e; margin: 1.2rem 0; }

.game-card {
    background: #161616;
    border: 1px solid #222;
    border-radius: 16px 16px 0 0;
    border-bottom: none;
    padding: 1.5rem;
    margin-bottom: 0;
    text-align: center;
    transition: all 0.15s ease;
}
.game-card:hover {
    border-color: #444;
}
.game-card .emoji { font-size: 3rem; margin-bottom: 0.5rem; }
.game-card .name {
    font-family: 'Space Mono', monospace;
    font-size: 1.2rem;
    color: #fff;
    margin-bottom: 0.3rem;
}
.game-card .desc {
    font-size: 0.8rem;
    color: #666;
}

.footer {
    text-align: center;
    margin-top: 2rem;
    font-size: 0.7rem;
    color: #333;
    letter-spacing: 0.06em;
}

.credits-card {
    background: linear-gradient(135deg, #161616, #1a1a1a);
    border: 1px solid #2a2a2a;
    border-radius: 16px;
    padding: 1.2rem;
    margin-top: 1.5rem;
    text-align: center;
}
.credits-card .made-by {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: #555;
    margin-bottom: 0.3rem;
}
.credits-card .name {
    font-family: 'Space Mono', monospace;
    font-size: 1.3rem;
    font-weight: 700;
    background: linear-gradient(90deg, #818cf8, #4ade80);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

/* page_link styling */
div[data-testid="stPageLink"] {
    margin-top: 0;
    margin-bottom: 1.2rem;
}
div[data-testid="stPageLink"] a {
    background: #1f1f1f !important;
    border: 1px solid #222 !important;
    border-radius: 0 0 16px 16px !important;
    color: #f0f0f0 !important;
    font-family: 'Space Grotesk', sans-serif !important;
    font-weight: 600 !important;
    font-size: 0.85rem !important;
    padding: 0.8rem !important;
    transition: all 0.15s ease !important;
    justify-content: center !important;
}
div[data-testid="stPageLink"] a:hover {
    background: #2a2a2a !important;
    border-color: #555 !important;
}
div[data-testid="stPageLink"] a p {
    color: #f0f0f0 !important;
}
</style>
""", unsafe_allow_html=True)

st.markdown("""
<div class="page-title">
    <h1>🎮 AhaD's Project Hub</h1>
    <p>3 games — pick one below or from the sidebar</p>
</div>
""", unsafe_allow_html=True)

st.markdown('<hr class="divider">', unsafe_allow_html=True)

st.markdown("""
<div class="game-card">
    <div class="emoji">✊🖐️✌️</div>
    <div class="name">Rock Paper Scissors</div>
    <div class="desc">Classic hand game against the computer</div>
</div>
""", unsafe_allow_html=True)
st.page_link("pages/1_Rock_Paper_Scissors.py", label="▶ Play Rock Paper Scissors", use_container_width=True)

st.markdown("""
<div class="game-card">
    <div class="emoji">🔢</div>
    <div class="name">Guess the Number</div>
    <div class="desc">Can you guess the number between 1-100?</div>
</div>
""", unsafe_allow_html=True)
st.page_link("pages/2_Guess_the_Number.py", label="▶ Play Guess the Number", use_container_width=True)

st.markdown("""
<div class="game-card">
    <div class="emoji">🏏</div>
    <div class="name">Hand Cricket</div>
    <div class="desc">Full T20 match vs CricBot — toss, bat, bowl, win!</div>
</div>
""", unsafe_allow_html=True)
st.page_link("pages/3_Hand_Cricket.py", label="▶ Play Hand Cricket", use_container_width=True)

st.markdown("""
<div class="credits-card">
    <div class="made-by">Made With ❤️ By</div>
    <div class="name">AhaD</div>
</div>
""", unsafe_allow_html=True)
