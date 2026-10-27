"""Dados sintéticos: estes testes não coletam comentários reais do YouTube."""
from pathlib import Path
from unittest.mock import Mock

import pytest
import requests
from streamlit.testing.v1 import AppTest

import coletor_core as core

APP = str(Path(__file__).with_name("coletor_de_comentarios.py"))
ASSUNTO = "crina de cavalo crescer"
TEXTO = "Não consigo fazer a crina do meu cavalo crescer. O que fazer?"


def resposta(dados, status=200):
    return Mock(status_code=status, json=Mock(return_value=dados))


def comentario(texto=TEXTO, likes=3):
    return {"snippet": {"topLevelComment": {"snippet": {"textDisplay": texto, "likeCount": likes}}}}


def video(identificador, views=100, comentarios=30):
    return {"id": identificador, "snippet": {"title": "Vídeo simulado " + identificador,
            "channelTitle": "Canal simulado"},
            "statistics": {"viewCount": str(views), "commentCount": str(comentarios)}}


@pytest.fixture(autouse=True)
def sem_chave_real(monkeypatch):
    monkeypatch.delenv("YOUTUBE_API_KEY", raising=False)
    monkeypatch.setattr("dotenv.load_dotenv", lambda *a, **k: None)
    # Toda conexão no conjunto de testes precisa ser explicitamente simulada.
    monkeypatch.setattr(core.requests, "get", Mock(side_effect=AssertionError("Rede não simulada")))


def app_com_chave():
    app = AppTest.from_file(APP).run()
    assert not app.exception
    assert app.text_area[0].value == "motobomba a gasolina"
    app.text_area[0].set_value(ASSUNTO)
    app.text_input[0].set_value("CHAVE_FICTICIA_PARA_TESTES").run()
    return app


def test_busca_ordena_deduplica_e_exclui_poucos_comentarios(monkeypatch):
    get = Mock(side_effect=[resposta({"items": [{"id": {"videoId": i}} for i in ["a", "b", "a", "c"]]}),
                            resposta({"items": [video("a", 100), video("b", 300), video("c", 900, 2)]})])
    monkeypatch.setattr(core.requests, "get", get)
    assert [v["id"] for v in core.buscar_videos([ASSUNTO], "ficticia", min_comentarios=20, ordem="viewCount")] == ["b", "a"]
    assert get.call_args_list[0].kwargs["params"]["q"] == ASSUNTO
    assert get.call_args_list[1].kwargs["params"]["id"] == "a,b,c"


def test_paginacao_respeita_limite(monkeypatch):
    get = Mock(side_effect=[resposta({"items": [comentario()] * 100, "nextPageToken": "segunda"}),
                            resposta({"items": [comentario()] * 50})])
    monkeypatch.setattr(core.requests, "get", get)
    assert len(core.baixar_comentarios("a", 150, "ficticia")) == 150
    assert get.call_args.kwargs["params"]["maxResults"] == 50
    assert get.call_args.kwargs["params"]["pageToken"] == "segunda"


def test_busca_padrao_nao_exclui_antigos_ou_videos_com_poucos_comentarios(monkeypatch):
    get = Mock(side_effect=[resposta({"items": [{"id": {"videoId": "antigo"}}]}),
                            resposta({"items": [video("antigo", comentarios=1)]})])
    monkeypatch.setattr(core.requests, "get", get)
    assert core.buscar_videos(["Motobombas a gasolina que não puxam água"], "ficticia")[0]["id"] == "antigo"
    params = get.call_args_list[0].kwargs["params"]
    assert "publishedAfter" not in params
    assert params["order"] == "relevance"
    assert params["maxResults"] == 50


def test_busca_paginas_intercala_termos_e_explica_descartes(monkeypatch):
    chamadas = []
    def consulta(recurso, chave, **params):
        chamadas.append((recurso, params))
        if recurso == "videos":
            return {"items": [video("a"), video("b"), video("c", comentarios=0), video("d", comentarios=2)]}
        if params["q"] == "primeira":
            if "pageToken" not in params:
                return {"items": [{"id": {"videoId": "a"}}, {"id": {"videoId": "c"}}], "nextPageToken": "pag2"}
            return {"items": [{"id": {"videoId": "d"}}]}
        return {"items": [{"id": {"videoId": "b"}}, {"id": {"videoId": "a"}}]}
    monkeypatch.setattr(core, "consultar", consulta)
    diag = {}
    resultado = core.buscar_videos(["primeira", "segunda"], "ficticia", limite=2, diagnostico=diag)
    assert [v["id"] for v in resultado] == ["a", "b"]
    assert diag["retornados"] == 5
    assert diag["unicos"] == 4
    assert diag["duplicados"] == 1
    assert diag["sem_comentarios_suficientes"] == 1
    assert diag["fora_do_limite"] == 1
    assert diag["consultas_busca"] == 3
    assert chamadas[1][1]["pageToken"] == "pag2"


def test_busca_respeita_periodo_e_limite_de_paginas(monkeypatch):
    chamadas = []
    def consulta(recurso, chave, **params):
        chamadas.append((recurso, params))
        if recurso == "videos":
            return {"items": [video("a")]}
        return {"items": [{"id": {"videoId": "a"}}], "nextPageToken": "mais"}
    monkeypatch.setattr(core, "consultar", consulta)
    core.buscar_videos(["teste"], "ficticia", dias=30, paginas=1)
    assert len(chamadas) == 2
    assert "publishedAfter" in chamadas[0][1]


def test_busca_contabiliza_videos_sem_detalhes(monkeypatch):
    get = Mock(side_effect=[resposta({"items": [{"id": {"videoId": "removido"}}]}),
                            resposta({"items": []})])
    monkeypatch.setattr(core.requests, "get", get)
    diag = {}
    assert core.buscar_videos(["teste"], "ficticia", diagnostico=diag) == []
    assert diag["indisponiveis"] == 1
    assert diag["selecionados"] == 0


@pytest.mark.parametrize("motivo,classe,mensagem", [
    ("commentsDisabled", core.ComentariosDesativados, "desativados"),
    ("quotaExceeded", core.ErroYouTube, "cota"),
    ("keyInvalid", core.ErroYouTube, "chave"),
    ("accessNotConfigured", core.ErroYouTube, "Ative"),
    ("forbidden", core.ErroYouTube, "Acesso negado"),
])
def test_erros_nao_viram_resultado_vazio(monkeypatch, motivo, classe, mensagem):
    monkeypatch.setattr(core.requests, "get", Mock(return_value=resposta(
        {"error": {"errors": [{"reason": motivo}], "message": "URL com CHAVE_SECRETA"}}, 403)))
    with pytest.raises(classe, match=mensagem) as erro:
        core.baixar_comentarios("a", 50, "CHAVE_SECRETA")
    assert "CHAVE_SECRETA" not in str(erro.value)


@pytest.mark.parametrize("excecao", [requests.Timeout("CHAVE_SECRETA"), requests.ConnectionError("CHAVE_SECRETA")])
def test_falhas_de_conexao_nao_expoem_chave(monkeypatch, excecao):
    monkeypatch.setattr(core.requests, "get", Mock(side_effect=excecao))
    with pytest.raises(core.ErroYouTube) as erro:
        core.consultar("search", "CHAVE_SECRETA")
    assert "CHAVE_SECRETA" not in str(erro.value)


def test_interface_sem_chave_nao_coleta():
    app = AppTest.from_file(APP).run()
    assert not app.exception
    assert app.button[0].disabled


def test_site_nao_revela_chave_do_servidor_e_isola_sessoes(monkeypatch):
    monkeypatch.setenv("YOUTUBE_API_KEY", "CHAVE_FICTICIA_DO_SERVIDOR")
    monkeypatch.setenv("LOWWAVE_WEB", "1")
    entrada = str(Path(APP).with_name("app.py"))
    primeira = AppTest.from_file(entrada).run()
    assert not primeira.exception
    assert primeira.text_input[0].value == ""
    primeira.text_input[0].set_value("CHAVE_FICTICIA_VISITANTE_1").run()
    segunda = AppTest.from_file(entrada).run()
    assert not segunda.exception
    assert segunda.text_input[0].value == ""
    assert segunda.button[0].disabled
    assert primeira.text_input[0].value == "CHAVE_FICTICIA_VISITANTE_1"
    assert not any("Configurar Chave.bat" in c.value for c in segunda.caption)


def test_fluxo_com_assunto_filtra_exporta_e_mantem_resultado(monkeypatch):
    get = Mock(side_effect=[resposta({"items": [{"id": {"videoId": "simulado"}}]}),
                            resposta({"items": [video("simulado")]}),
                            resposta({"items": [comentario(), comentario(), comentario("top"),
                                comentario("Veja meus produtos e dicas em https://exemplo.invalid")]})])
    monkeypatch.setattr(core.requests, "get", get)
    app = app_com_chave()
    app.button[0].click().run()
    assert not app.exception
    assert not app.error
    assert app.session_state["stats"] == (1, 4, 1)
    assert ASSUNTO in app.code[0].value
    assert TEXTO in app.code[0].value
    assert app.code[0].value.count(TEXTO) == 1
    assert "exemplo.invalid" not in app.code[0].value
    assert len(app.get("download_button")) == 1
    app.run()
    assert TEXTO in app.code[0].value


def test_erro_de_api_limpa_resultado_anterior(monkeypatch):
    app = app_com_chave()
    app.session_state["texto"] = "resultado antigo"
    app.session_state["resumo"] = []
    app.session_state["stats"] = (0, 0, 0)
    monkeypatch.setattr(core.requests, "get", Mock(return_value=resposta(
        {"error": {"errors": [{"reason": "quotaExceeded"}]}}, 403)))
    app.button[0].click().run()
    assert not app.exception
    assert "cota" in app.error[-1].value
    assert not app.code


def test_nenhum_video_mostra_orientacao(monkeypatch):
    app = app_com_chave()
    monkeypatch.setattr(core.requests, "get", Mock(return_value=resposta({"items": []})))
    app.button[0].click().run()
    assert not app.exception
    assert "Nenhum vídeo" in app.info[0].value


def test_limite_total_com_quinze_videos(monkeypatch):
    app = app_com_chave()
    app.slider[0].set_value(15)
    app.slider[2].set_value(50).run()
    def consultar(recurso, chave, **params):
        if recurso == "search":
            return {"items": [{"id": {"videoId": str(i)}} for i in range(15)]}
        if recurso == "videos":
            return {"items": [video(str(i)) for i in range(15)]}
        return {"items": [comentario(f"Não consigo fazer a crina crescer no cavalo {params['videoId']}, tentativa {i}.") for i in range(20)]}
    monkeypatch.setattr(core, "consultar", consultar)
    app.button[0].click().run()
    assert not app.exception
    assert not app.error
    assert app.session_state["stats"][2] == 50


def test_comentarios_desativados_avisa_sem_fingir_falha_de_chave(monkeypatch):
    app = app_com_chave()
    monkeypatch.setattr(core.requests, "get", Mock(side_effect=[
        resposta({"items": [{"id": {"videoId": "a"}}]}),
        resposta({"items": [video("a")]}),
        resposta({"error": {"errors": [{"reason": "commentsDisabled"}]}}, 403)]))
    app.button[0].click().run()
    assert not app.exception
    assert not app.error
    assert "desativados" in app.warning[0].value
    assert not app.code


def test_filtro_de_dor_e_leitura_de_chave_do_ambiente(monkeypatch):
    monkeypatch.setenv("YOUTUBE_API_KEY", "CHAVE_FICTICIA_AMBIENTE")
    app = AppTest.from_file(APP).run()
    assert app.text_input[0].value == "CHAVE_FICTICIA_AMBIENTE"
    app.checkbox[0].check().run()
    monkeypatch.setattr(core.requests, "get", Mock(side_effect=[
        resposta({"items": [{"id": {"videoId": "a"}}]}),
        resposta({"items": [video("a")]}),
        resposta({"items": [comentario(), comentario("Eu cuido da crina do meu cavalo todas as tardes.")]})]))
    app.button[0].click().run()
    assert not app.exception
    assert not app.error
    assert app.session_state["stats"] == (1, 2, 1)
    assert TEXTO in app.code[0].value


def test_resposta_invalida_e_pagina_repetida(monkeypatch):
    monkeypatch.setattr(core.requests, "get", Mock(return_value=Mock(status_code=200, json=Mock(side_effect=ValueError()))))
    with pytest.raises(core.ErroYouTube, match="inválida"):
        core.consultar("search", "ficticia")
    monkeypatch.setattr(core.requests, "get", Mock(return_value=resposta({"items": [], "nextPageToken": "repetida"})))
    with pytest.raises(core.ErroYouTube, match="repetiu"):
        core.baixar_comentarios("a", 50, "ficticia")
