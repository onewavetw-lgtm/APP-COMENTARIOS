"""Identidade visual LowWave, sem fontes ou recursos externos."""
import streamlit as st


def aplicar_estilo():
    st.markdown('''<style>
    :root {color-scheme:dark;}
    .stApp {background:radial-gradient(ellipse at 90% 0%,#142a2780,transparent 45%),#0b0f14;color:#e9eef5;}
    [data-testid="stHeader"] {background:transparent;}
    [data-testid="stMainBlockContainer"] {max-width:1180px;padding-top:2.6rem;padding-bottom:4rem;}
    [data-testid="stSidebar"] {background:#10151d;border-right:1px solid #242c37;}
    [data-testid="stSidebarContent"] {padding-top:1.5rem;}
    [data-testid="stSidebar"] hr {border-color:#262e3a;}
    html,body,[class*="css"] {font-family:"Segoe UI",Inter,Arial,sans-serif;}
    h1,h2,h3 {letter-spacing:-.035em;}
    h3 {font-size:1.25rem!important;}
    p,li {line-height:1.65;}
    [data-testid="stCaptionContainer"],[data-testid="stCaptionContainer"] p {color:#a5b2c3!important;opacity:1!important;}
    [data-testid="stTextArea"] textarea,[data-testid="stTextInput"] input {background:#0c1118!important;color:#e9eef5!important;}
    [data-baseweb="textarea"],[data-baseweb="input"] {border:1px solid #303b48!important;border-radius:10px!important;}
    [data-baseweb="textarea"]:focus-within,[data-baseweb="input"]:focus-within {border-color:#68e0bc!important;box-shadow:0 0 0 3px #68e0bc12;}
    [data-testid="stVerticalBlockBorderWrapper"] {border-radius:16px!important;}
    [data-testid="stVerticalBlockBorderWrapper"]>div {border-color:#28313e!important;}
    [data-testid="stExpander"] {background:#121922;border:1px solid #28313e;border-radius:12px;}
    [data-testid="stBaseButton-primary"] {background:#6de3bf;color:#08251c;border:1px solid #6de3bf;border-radius:10px;font-weight:700;min-height:46px;}
    [data-testid="stBaseButton-primary"]:hover {background:#91efd2;border-color:#91efd2;color:#08251c;}
    [data-testid="stBaseButton-primary"]:disabled {background:#233c35;color:#85a398;border-color:#344f46;}
    [data-testid="stBaseButton-secondary"] {border-radius:10px;}
    [data-testid="stMetric"] {background:#131b25;border:1px solid #283340;border-radius:12px;padding:18px;}
    [data-testid="stMetricValue"] {font-size:1.9rem;font-weight:650;letter-spacing:-.04em;}
    [data-testid="stMetricLabel"] {color:#9aa9ba;}
    [data-testid="stCode"] {border:1px solid #283340;border-radius:12px;}
    .eco-brand {display:flex;align-items:center;gap:12px;margin-bottom:28px;}
    .eco-mark {width:40px;height:40px;background:#6de3bf;display:flex;align-items:center;justify-content:center;border-radius:12px;color:#0b2e22;font-size:25px;font-weight:800;}
    .eco-name {font-size:28px;letter-spacing:-1px;font-weight:750;line-height:1.1;}
    .eco-small {color:#8d9caf;font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin-top:5px;}
    .eco-nav {border:1px solid #36564b;background:#182b26;padding:12px 14px;border-radius:10px;color:#9ce7cc;font-size:14px;font-weight:600;}
    .eco-step {display:flex;gap:12px;margin:18px 0;color:#a7b3c3;font-size:13px;}
    .eco-step b {color:#e3eaf3;display:block;font-size:13px;font-weight:600;}
    .eco-step span {color:#6de3bf;font-size:11px;font-weight:650;padding-top:3px;}
    .eco-eyebrow {font-size:11px;font-weight:650;text-transform:uppercase;letter-spacing:.15em;color:#8da395;}
    .eco-top {display:flex;justify-content:space-between;align-items:center;gap:16px;padding-bottom:26px;border-bottom:1px solid #232e38;margin-bottom:32px;}
    .eco-pill {font-size:11px;letter-spacing:.02em;border:1px solid #304339;border-radius:50px;padding:6px 12px;color:#a7c5b9;white-space:nowrap;}
    .eco-hero {margin-bottom:30px;}
    .eco-hero h1 {font-size:clamp(32px,4vw,48px);font-weight:700;line-height:1.12;margin:12px 0 15px;padding:0;letter-spacing:-.045em;max-width:730px;}
    .eco-hero h1 em {font-style:normal;color:#7ce4c2;}
    .eco-hero p {font-size:15px;line-height:1.7;color:#9daec0;max-width:630px;margin:0;}
    .eco-section {font-size:11px;letter-spacing:.13em;color:#8496ab;font-weight:650;margin:5px 0 8px;}
    .eco-note {border-left:2px solid #6de3bf;padding:0 0 0 16px;margin:14px 0;color:#a5b3c3;font-size:13px;line-height:1.7;}
    .eco-note strong {color:#e2ebe6;}
    .eco-footer {font-size:11px;color:#728196;border-top:1px solid #242e3b;padding-top:16px;margin-top:25px;}
    .eco-empty {text-align:center;padding:36px 20px;border:1px dashed #32404e;border-radius:16px;margin-top:24px;background:#10172080;}
    .eco-empty .symbol {color:#6de3bf;font-size:28px;}
    .eco-empty h3 {margin:8px 0;color:#cad6e3;font-size:16px!important;letter-spacing:-.02em;}
    .eco-empty p {color:#8293a8;font-size:13px;max-width:420px;margin:0 auto;}
    @media(max-width:700px) {
      [data-testid="stMainBlockContainer"] {padding-top:1.5rem;}
      .eco-top {margin-bottom:22px;padding-bottom:18px;}
      .eco-pill {font-size:10px;padding:5px 8px;}
      [data-testid="stMetric"] {padding:12px;}
    }
    </style>''', unsafe_allow_html=True)


def marca():
    st.markdown('''<div class="eco-brand"><div class="eco-mark">≋</div><div>
    <div class="eco-name">LowWave<span style="color:#6de3bf">.</span></div>
    <div class="eco-small">Escute. Descubra. Crie.</div></div></div>
    <div class="eco-nav">◉ &nbsp; Pesquisa de público</div>''', unsafe_allow_html=True)


def cabecalho():
    st.markdown('''<div class="eco-top"><span class="eco-eyebrow">Workspace / Nova pesquisa</span>
    <span class="eco-pill">YouTube · Comentários públicos</span></div>
    <div class="eco-hero"><div class="eco-eyebrow">Menos suposição. Mais escuta.</div>
    <h1>Sua próxima ideia começa<br>na <em>voz do público.</em></h1>
    <p>Reúna experiências, dúvidas e frustrações reais. Leve os relatos ao ChatGPT
    e descubra quais dores merecem sua atenção.</p></div>''', unsafe_allow_html=True)


def passos():
    st.markdown('''<div class="eco-section">DO COMENTÁRIO À DESCOBERTA</div>
    <div class="eco-step"><span>01</span><div><b>Explore um público</b>Comece com um tema amplo, sem escolher a dor.</div></div>
    <div class="eco-step"><span>02</span><div><b>Reúna os relatos</b>O LowWave coleta comentários e remove spam e repetições.</div></div>
    <div class="eco-step"><span>03</span><div><b>Descubra os padrões</b>Exporte o texto e faça a análise no ChatGPT.</div></div>''', unsafe_allow_html=True)


def vazio():
    st.markdown('''<div class="eco-empty"><div class="symbol">◎</div>
    <h3>Os próximos sinais estão nos comentários</h3>
    <p>Inicie uma pesquisa para ver os vídeos, os relatos selecionados e o texto pronto para análise.</p>
    </div>''', unsafe_allow_html=True)
