"""Acesso ao YouTube com mensagens seguras, sem mostrar URLs com a chave."""
from datetime import datetime, timedelta, timezone
import re

import requests

YT = "https://www.googleapis.com/youtube/v3"


class ErroYouTube(Exception):
    pass


class ComentariosDesativados(ErroYouTube):
    pass


def consultar(recurso, chave, **params):
    try:
        resposta = requests.get(f"{YT}/{recurso}", params={**params, "key": chave}, timeout=30)
    except requests.Timeout:
        raise ErroYouTube("O YouTube demorou para responder. Tente novamente.") from None
    except requests.RequestException:
        raise ErroYouTube("Não foi possível conectar ao YouTube. Verifique a conexão e o acesso a www.googleapis.com.") from None
    try:
        dados = resposta.json()
    except ValueError:
        raise ErroYouTube("O serviço retornou uma resposta inválida. Tente novamente.") from None
    if resposta.status_code != 200:
        erro = dados.get("error", {})
        motivos = {e.get("reason") for e in erro.get("errors", [])}
        if "commentsDisabled" in motivos:
            raise ComentariosDesativados("Este vídeo está com os comentários desativados.")
        if motivos & {"quotaExceeded", "dailyLimitExceeded"}:
            mensagem = "A cota do YouTube acabou. Consulte a cota no Google Cloud e tente após a renovação diária."
        elif motivos & {"keyInvalid", "badRequest"} or resposta.status_code == 400:
            mensagem = "O YouTube recusou a solicitação. Confira a chave e os parâmetros da busca."
        elif "accessNotConfigured" in motivos:
            mensagem = "Ative a YouTube Data API v3 no mesmo projeto da chave e aguarde alguns minutos."
        elif resposta.status_code in (401, 403):
            mensagem = "Acesso negado. Confira a chave, as restrições, a ativação da YouTube Data API v3 e a permissão de rede."
        else:
            mensagem = f"O YouTube retornou erro HTTP {resposta.status_code}. Tente novamente mais tarde."
        raise ErroYouTube(mensagem)
    return dados


def buscar_videos(termos, chave, dias=0, limite=15, *, ordem="relevance",
                  min_comentarios=1, paginas=2, diagnostico=None):
    if ordem not in {"relevance", "viewCount"} or not 1 <= paginas <= 3:
        raise ValueError("Configuração de busca inválida.")
    params = dict(part="snippet", type="video", order=ordem, maxResults=50,
                  regionCode="BR", relevanceLanguage="pt")
    if dias:
        params["publishedAfter"] = (datetime.now(timezone.utc) - timedelta(days=dias)).strftime("%Y-%m-%dT%H:%M:%SZ")
    por_termo = []
    retornados = consultas = 0
    for termo in termos:
        encontrados, token, tokens = [], None, set()
        for _ in range(paginas):
            pagina = {**params, "q": termo}
            if token:
                pagina["pageToken"] = token
            dados = consultar("search", chave, **pagina)
            consultas += 1
            encontrados.extend(i["id"]["videoId"] for i in dados.get("items", []))
            token = dados.get("nextPageToken")
            if not token or token in tokens:
                break
            tokens.add(token)
        retornados += len(encontrados)
        por_termo.append(encontrados)
    # Intercale posições para uma busca não ocupar todas as vagas das demais.
    ids = list(dict.fromkeys(
        lista[pos] for pos in range(max(map(len, por_termo), default=0))
        for lista in por_termo if pos < len(lista)
    ))
    videos = []
    for inicio in range(0, len(ids), 50):
        dados = consultar("videos", chave, part="snippet,statistics", id=",".join(ids[inicio:inicio + 50]))
        for video in dados.get("items", []):
            stats = video.get("statistics", {})
            videos.append({"id": video["id"], "titulo": video["snippet"]["title"],
                           "canal": video["snippet"]["channelTitle"],
                           "views": int(stats.get("viewCount", 0)),
                           "coments": int(stats.get("commentCount", 0)),
                           "url": f"https://www.youtube.com/watch?v={video['id']}"})
    ordem_ids = {identificador: pos for pos, identificador in enumerate(ids)}
    videos.sort(key=lambda v: ordem_ids[v["id"]])
    detalhes = len(videos)
    videos = [v for v in videos if v["coments"] >= min_comentarios]
    if ordem == "viewCount":
        videos.sort(key=lambda v: v["views"], reverse=True)
    if diagnostico is not None:
        diagnostico.update(retornados=retornados, unicos=len(ids), duplicados=retornados - len(ids),
                           indisponiveis=len(ids) - detalhes, sem_comentarios_suficientes=detalhes - len(videos),
                           elegiveis=len(videos), fora_do_limite=max(0, len(videos) - limite),
                           selecionados=min(limite, len(videos)), consultas_busca=consultas,
                           dias=dias, minimo_comentarios=min_comentarios, ordem=ordem)
    return videos[:limite]


def baixar_comentarios(video_id, limite, chave):
    resultado, token = [], None
    tokens = set()
    while len(resultado) < limite:
        params = dict(part="snippet", videoId=video_id, maxResults=min(100, limite - len(resultado)),
                      order="relevance", textFormat="plainText")
        if token:
            params["pageToken"] = token
        dados = consultar("commentThreads", chave, **params)
        for item in dados.get("items", []):
            snippet = item["snippet"]["topLevelComment"]["snippet"]
            resultado.append((snippet.get("likeCount", 0), re.sub(r"\s+", " ", snippet["textDisplay"]).strip()))
        token = dados.get("nextPageToken")
        if not token:
            break
        if token in tokens:
            raise ErroYouTube("O YouTube repetiu uma página de comentários. Tente novamente.")
        tokens.add(token)
    return resultado[:limite]
