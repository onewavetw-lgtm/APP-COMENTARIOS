"""
Coletor de Comentários do YouTube -> pronto para colar no ChatGPT
SEM IA: usa a cota gratuita da YouTube Data API.

Você digita o assunto. O app acha os vídeos mais vistos, baixa os comentários,
tira o lixo (emoji, "top", spam, repetidos) e entrega um texto pronto para copiar
ou baixar em .txt e enviar ao ChatGPT.

Instalar:  pip install -r requirements.txt
Rodar:     streamlit run coletor_de_comentarios.py
"""

import os
import re
from pathlib import Path

from dotenv import load_dotenv
from coletor_core import buscar_videos, baixar_comentarios, ErroYouTube, ComentariosDesativados

import streamlit as st
from interface import aplicar_estilo, marca, cabecalho, passos, vazio

load_dotenv(Path(__file__).with_name(".env"))
MODO_WEB = os.getenv("LOWWAVE_WEB") == "1"
CHAVE_INICIAL = "" if MODO_WEB else os.getenv("YOUTUBE_API_KEY", "")

PALAVRAS_DOR = (
    "não liga, não funciona, não pega, não parte, não dá partida, problema, defeito, queimou, "
    "travou, parou, quebrou, ajuda, socorro, como resolver, como consertar, por que, porque, "
    "o que fazer, barulho, vazando, esquenta, erro, caro, gastei, tentei, não adianta, difícil, "
    "não consigo, não sei"
)

PROMPT_PADRAO = """Analise os comentários abaixo sobre: {assunto}.

Quero descobrir uma dor específica desse público. Ainda não sei qual é essa dor.
Não escolha um problema antecipadamente nem force os relatos a confirmar uma ideia.

1. Identifique dificuldades, frustrações, dúvidas, desejos e experiências negativas, inclusive indiretas.
2. Agrupe relatos sobre o mesmo problema e apresente frases literais como evidência.
3. Diferencie padrões recorrentes de relatos isolados e considere se aparecem em vídeos diferentes. Curtidas não provam frequência.
4. Separe o que foi dito da sua interpretação. Não invente motivos quando faltar contexto.
5. Compare as dores por repetição, intensidade, consequências e tentativas de solução.
6. Indique qual dor tem melhores evidências para aprofundar. Se os dados forem insuficientes, diga isso e sugira novas buscas.

Primeiro descubra e explique a dor. Não crie uma oferta antes de apresentar as evidências.
"""

PRAISE = re.compile(
    r"^(top+|show|parab[eé]ns|muito bom|[oó]timo v[ií]deo|excelente|obrigad[oa]|valeu|boa|"
    r"gostei|amei|perfeito|sensacional|nota 10)\b",
    re.I,
)
SPAM = re.compile(r"(https?://|www\.|whatsapp|telegram|chama no zap|inscreva-se|sorteio)", re.I)

st.set_page_config(page_title="LowWave · Pesquisa de público", page_icon="◎", layout="wide")
aplicar_estilo()

with st.sidebar:
    marca()
    st.write("")
    st.caption("CONEXÃO COM O YOUTUBE")
    with st.expander("Chave de acesso", expanded=not bool(CHAVE_INICIAL)):
        yt_key = st.text_input("Chave YouTube API", value=CHAVE_INICIAL, type="password").strip()
        if MODO_WEB:
            st.caption("Cole sua chave para esta sessão. O LowWave não a salva em arquivo. Ao abrir uma nova sessão, pode ser necessário informá-la novamente.")
        else:
            st.caption("Cole sua chave ou use Configurar Chave.bat para salvá-la neste computador.")
    st.caption("Chave informada · pronta para tentar a coleta" if yt_key else "Aguardando sua chave para iniciar")
    st.divider()
    passos()
    st.markdown('<div class="eco-footer">LOWWAVE / PESQUISA DE PÚBLICO<br>A coleta usa a cota da sua YouTube Data API.</div>', unsafe_allow_html=True)

cabecalho()
pesquisa, guia = st.columns([2.1, 1], gap="large")
with pesquisa:
    with st.container(border=True):
        st.markdown('<div class="eco-section">01 / DEFINA O PONTO DE PARTIDA</div>', unsafe_allow_html=True)
        st.subheader("Qual público você quer escutar?")
        st.caption("Pesquise o tema. Deixe os comentários revelarem o problema.")
        assunto = st.text_area(
            "Tema ou buscas — uma por linha",
            value="motobomba a gasolina",
            placeholder="motobomba a gasolina\nmotobomba a gasolina avaliação\nmotobomba a gasolina teste",
            height=115,
        )
        st.caption("Dica: combine buscas amplas e avaliações para reunir experiências diferentes.")

    with st.expander("Ajustar coleta e filtros"):
        st.caption("Comece com os valores sugeridos. A quantidade final depende dos vídeos e dos filtros.")
        n_videos = st.slider("Quantos vídeos", 1, 50, 15)
        n_coms = st.slider("Comentários baixados por vídeo", 50, 500, 200, 50)
        max_total = st.slider("Máximo de comentários no resultado", 50, 1000, 300, 50)
        dias = st.slider("Vídeos dos últimos X dias (0 = qualquer época)", 0, 5475, 0, 30)
        min_letras = st.slider("Mínimo de letras por comentário", 10, 100, 20, 5)
        min_comentarios = st.slider("Mínimo de comentários no vídeo", 1, 100, 1)
        ordem_nome = st.selectbox("Priorizar vídeos por", ["Relevância para a busca", "Mais visualizações"])
        ordem = "relevance" if ordem_nome == "Relevância para a busca" else "viewCount"
        paginas = st.slider("Páginas de busca por termo", 1, 3, 2)
        st.caption("Cada página consulta até 50 vídeos. Mais páginas e mais termos usam mais cota da API. A busca não é idêntica à página personalizada do YouTube.")
        so_dor = st.checkbox("Manter só comentários com palavras de dor", value=False)
        st.caption("Para descobrir uma dor que você ainda não conhece, deixe esse filtro desmarcado.")
        palavras = st.text_area("Palavras de dor (separadas por vírgula)", PALAVRAS_DOR, height=100)
        add_prompt = st.checkbox("Incluir prompt no início do texto", value=True)

    with st.expander("Orientação para a análise no ChatGPT"):
        st.caption("Esta orientação acompanha o arquivo exportado. Ela não restringe a busca no YouTube.")
        prompt_txt = st.text_area("Prompt para o ChatGPT (editável)", PROMPT_PADRAO, height=250)

    termos = [t.strip() for t in assunto.splitlines() if t.strip()]
    coletar = st.button("Coletar comentários", icon=":material/search:", type="primary",
                        disabled=not (termos and yt_key), width="stretch")
    if not yt_key:
        st.caption("Para liberar a coleta, informe sua chave no menu lateral. No celular, abra o menu no topo.")
    elif not termos:
        st.caption("Digite pelo menos um tema para começar.")
    else:
        st.caption(f"Até {n_videos} vídeos · {n_coms} comentários por vídeo · até {max_total} no resultado")

with guia:
    with st.container(border=True):
        st.markdown('<div class="eco-section">DO PÚBLICO PARA SUA PESQUISA</div>', unsafe_allow_html=True)
        st.subheader("Escute antes de criar.")
        st.markdown('<div class="eco-note">Você não precisa saber a dor de antemão. <strong>Esse é o ponto da pesquisa.</strong></div>', unsafe_allow_html=True)
        st.markdown("**Relatos organizados**")
        st.caption("Comentários públicos principais, com curtidas, sem spam e sem repetições no resultado.")
        st.markdown("**Fontes para conferir**")
        st.caption("Veja os vídeos selecionados e abra os links para entender o contexto.")
        st.markdown("**Pronto para o ChatGPT**")
        st.caption("Baixe um arquivo com os comentários e a orientação para descobrir padrões.")
    with st.expander("Como os comentários são escolhidos?"):
        st.caption("Buscamos até 50 vídeos por página e termo, sem limite de data por padrão. Você escolhe a quantidade de páginas, a prioridade por relevância ou visualizações e o mínimo de comentários (padrão: 1). Vídeos repetidos entre buscas entram uma única vez. Em relevância, alternamos os resultados dos termos para não favorecer somente a primeira busca. O YouTube fornece os comentários por relevância; o app prioriza curtidas e perguntas. O filtro de palavras é opcional. Essa seleção é uma amostra, não representa todo o público.")


# ------------------------------ Funções ------------------------------
def filtrar(coms, kws, vistos):
    saida = []
    for likes, t in coms:
        letras = len(re.findall(r"[A-Za-zÀ-ÿ]", t))
        baixo = t.lower()
        if letras < min_letras or SPAM.search(t):
            continue
        if letras < 45 and PRAISE.match(baixo) and "?" not in t:
            continue
        chave = re.sub(r"\W+", "", baixo)
        if chave in vistos:
            continue
        tem_dor = any(k in baixo for k in kws)
        if so_dor and not tem_dor:
            continue
        score = likes + (5 if "?" in t else 0) + (10 if so_dor and tem_dor else 0)
        saida.append((score, likes, t))
        vistos.add(chave)
    saida.sort(key=lambda x: x[0], reverse=True)  # mais relevantes primeiro
    return saida


# ------------------------------ Execução ------------------------------
if coletar:
    kws = [k.strip().lower() for k in palavras.split(",") if k.strip()]
    for campo in ("texto", "resumo", "stats", "diagnostico"):
        st.session_state.pop(campo, None)
    try:
        with st.status("Buscando...", expanded=True) as status:
            diagnostico = {}
            videos = buscar_videos(termos, yt_key, dias, n_videos, ordem=ordem,
                                   min_comentarios=min_comentarios, paginas=paginas, diagnostico=diagnostico)
            st.session_state["diagnostico"] = diagnostico
            st.write(f"{diagnostico['unicos']} vídeos únicos encontrados; {len(videos)} selecionados por {ordem_nome.lower()}.")
            st.caption(f"{diagnostico['duplicados']} resultados repetidos · "
                       f"{diagnostico['sem_comentarios_suficientes']} abaixo do mínimo de comentários · "
                       f"{diagnostico['indisponiveis']} sem detalhes disponíveis · "
                       f"{diagnostico['fora_do_limite']} fora do limite escolhido.")
            if not videos:
                status.update(label="Nenhum vídeo encontrado", state="complete")
                st.info("Nenhum vídeo com comentários suficientes foi encontrado. Use período 0 (qualquer época), reduza o mínimo de comentários ou mude os termos da busca.")
                st.stop()

            vistos, blocos, resumo = set(), [], []
            por_video, extras = divmod(max_total, len(videos))
            bruto_total = final_total = 0
            for indice, v in enumerate(videos):
                st.write(f"Lendo: {v['titulo']}")
                try:
                    bruto = baixar_comentarios(v["id"], n_coms, yt_key)
                except ComentariosDesativados:
                    st.warning(f"Comentários desativados: {v['titulo']}")
                    continue
                bom = filtrar(bruto, kws, vistos.copy())[:por_video + (indice < extras)]
                vistos.update(re.sub(r"\W+", "", t.lower()) for _, _, t in bom)
                bruto_total += len(bruto)
                final_total += len(bom)
                resumo.append({"Vídeo": v["titulo"], "Views": f"{v['views']:,}",
                               "Baixados": len(bruto), "Mantidos": len(bom), "Link": v["url"]})
                if bom:
                    linhas = "\n".join(f"- ({lk} likes) {t}" for _, lk, t in bom)
                    blocos.append(f"=== VÍDEO: {v['titulo']} ({v['views']:,} views) ===\n{linhas}")
            status.update(label="Pronto!", state="complete")

        if not final_total:
            st.info("Nenhum comentário passou pelos filtros. Reduza o mínimo de letras ou desmarque o filtro de dor.")
            st.stop()

        cab = prompt_txt.replace("{assunto}", ", ".join(termos)) + "\n\n" if add_prompt else ""
        st.session_state["texto"] = cab + "\n\n".join(blocos)
        st.session_state["resumo"] = resumo
        st.session_state["stats"] = (len(resumo), bruto_total, final_total)
        st.session_state["busca_realizada"] = ", ".join(termos)
    except ErroYouTube as erro:
        status.update(label="Coleta interrompida", state="error")
        st.error(str(erro))
    except Exception:
        status.update(label="Coleta interrompida", state="error")
        st.error("Ocorreu um erro inesperado. Tente novamente. Se persistir, peça suporte sem compartilhar a chave.")

# ------------------------------ Resultado ------------------------------
texto = st.session_state.get("texto")
if texto:
    st.divider()
    st.markdown('<div class="eco-section">02 / SUA PESQUISA, ORGANIZADA</div>', unsafe_allow_html=True)
    st.subheader("Os relatos estão aqui. O próximo passo é encontrar os padrões.")
    st.caption("Pesquisa: " + st.session_state.get("busca_realizada", ", ".join(termos)))
    diag = st.session_state.get("diagnostico", {})
    if diag:
        with st.expander("Entenda quantos vídeos entraram na pesquisa"):
            st.write(f"A busca retornou {diag['retornados']} resultados, incluindo {diag['duplicados']} repetições. "
                     f"Restaram {diag['unicos']} vídeos únicos; {diag['indisponiveis']} não tinham detalhes disponíveis. "
                     f"{diag['sem_comentarios_suficientes']} ficaram abaixo do mínimo de comentários. "
                     f"Dos {diag['elegiveis']} elegíveis, {diag['selecionados']} foram selecionados "
                     f"e {diag['fora_do_limite']} ficaram fora do limite escolhido.")
            st.caption("Período: " + (f"últimos {diag['dias']} dias" if diag['dias'] else "qualquer época") +
                       f" · Mínimo: {diag['minimo_comentarios']} comentário(s) · "
                       f"Chamadas de busca: {diag['consultas_busca']}. "
                       "Vídeos com comentários desativados podem ser pulados durante a coleta. Os totais abaixo refletem os vídeos lidos.")
    nv, bruto, final = st.session_state["stats"]
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Vídeos", nv)
    c2.metric("Comentários baixados", bruto)
    c3.metric("Depois do filtro", final)
    c4.metric("Caracteres", f"{len(texto):,}")

    if len(texto) > 60000:
        st.warning("Texto grande: o ChatGPT pode cortar ao colar. Baixe o .txt e anexe como arquivo, "
                   "ou reduza 'Máximo de comentários' na barra lateral.")

    st.download_button("Baixar pesquisa .txt", texto.encode("utf-8"),
                       file_name="lowwave-comentarios.txt", mime="text/plain", type="primary", icon=":material/download:")

    st.caption("Anexe o arquivo no ChatGPT e peça para executar a orientação do início. A análise acontece lá.")
    tab_texto, tab_fontes = st.tabs(["Texto para o ChatGPT", "Vídeos e fontes"])
    with tab_texto:
        st.caption("Para copiar, use o ícone no canto superior direito do bloco abaixo.")
        st.code(texto, language=None)

    with tab_fontes:
        st.dataframe(st.session_state["resumo"], use_container_width=True, hide_index=True,
                     column_config={"Link": st.column_config.LinkColumn("Link")})

else:
    vazio()
