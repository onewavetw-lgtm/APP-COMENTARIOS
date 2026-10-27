import shutil
from pathlib import Path
from zipfile import ZipFile

import pytest

import atualizar_lowwave as atualizador
from empacotar_lowwave import empacotar


@pytest.fixture
def instalacoes(tmp_path):
    origem, destino = tmp_path / "pacote", tmp_path / "instalado"
    for pasta, texto in [(origem, "nova versao"), (destino, "versao antiga")]:
        for nome in atualizador.ARQUIVOS:
            p = pasta / nome
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(texto)
    (destino / ".env").write_text("CHAVE_FICTICIA_PRESERVAR")
    marcador = destino / ".venv" / "coletor-instalado.txt"
    marcador.parent.mkdir()
    marcador.write_text("ok")
    return origem, destino


def test_atualiza_preserva_chave_e_faz_backup(instalacoes):
    origem, destino = instalacoes
    backup = atualizador.aplicar_atualizacao(origem, destino)
    assert (destino / ".env").read_text() == "CHAVE_FICTICIA_PRESERVAR"
    assert not (backup / ".env").exists()
    assert (backup / "coletor_de_comentarios.py").read_text() == "versao antiga"
    assert (destino / "coletor_de_comentarios.py").read_text() == "nova versao"
    assert not (destino / ".venv/coletor-instalado.txt").exists()


def test_mesmas_dependencias_preservam_marcador_e_repeticao_funciona(instalacoes):
    origem, destino = instalacoes
    (origem / "requirements.txt").write_bytes((destino / "requirements.txt").read_bytes())
    primeiro = atualizador.aplicar_atualizacao(origem, destino)
    segundo = atualizador.aplicar_atualizacao(origem, destino)
    assert primeiro != segundo
    assert (destino / ".venv/coletor-instalado.txt").read_text() == "ok"
    assert (destino / ".env").read_text() == "CHAVE_FICTICIA_PRESERVAR"


def test_pacote_incompleto_nao_altera_instalacao(instalacoes):
    origem, destino = instalacoes
    (origem / "interface.py").unlink()
    with pytest.raises(ValueError, match="incompleto"):
        atualizador.aplicar_atualizacao(origem, destino)
    assert (destino / "coletor_de_comentarios.py").read_text() == "versao antiga"
    assert not (destino / ".lowwave-backups").exists()


def test_recusa_pasta_errada_e_autoatualizacao(instalacoes, tmp_path):
    origem, destino = instalacoes
    with pytest.raises(ValueError, match="mesma|outra pasta"):
        atualizador.aplicar_atualizacao(destino, destino)
    with pytest.raises(ValueError, match="Escolha a pasta"):
        atualizador.aplicar_atualizacao(origem, tmp_path)


def test_falha_na_copia_restaura_arquivos(instalacoes, monkeypatch):
    origem, destino = instalacoes
    copiar = shutil.copy2
    def falhar(src, dst, *args, **kwargs):
        if Path(src) == origem / "interface.py":
            raise OSError("Falha simulada")
        return copiar(src, dst, *args, **kwargs)
    monkeypatch.setattr(atualizador.shutil, "copy2", falhar)
    with pytest.raises(OSError, match="simulada"):
        atualizador.aplicar_atualizacao(origem, destino)
    for nome in atualizador.ARQUIVOS:
        assert (destino / nome).read_text() == "versao antiga"
    assert (destino / ".env").read_text() == "CHAVE_FICTICIA_PRESERVAR"


def test_recusa_link_para_fora_da_instalacao(instalacoes, tmp_path):
    origem, destino = instalacoes
    p = destino / "interface.py"
    p.unlink()
    externo = tmp_path / "externo.py"
    externo.write_text("nao alterar")
    p.symlink_to(externo)
    with pytest.raises(ValueError, match="fora da pasta"):
        atualizador.aplicar_atualizacao(origem, destino)
    assert externo.read_text() == "nao alterar"


def test_pacote_completo_sem_segredos(tmp_path):
    pacote = empacotar(tmp_path)
    with ZipFile(pacote) as z:
        assert z.testzip() is None
        assert "Atualizar LowWave.bat" in z.namelist()
        assert "atualizar_lowwave.py" in z.namelist()
        assert all("arquivos/" + nome in z.namelist() for nome in atualizador.ARQUIVOS)
        assert not any(Path(n).name == ".env" or ".venv" in Path(n).parts for n in z.namelist())
