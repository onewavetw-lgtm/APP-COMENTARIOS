"""Gera atualizações sem credenciais: python empacotar_lowwave.py --destino /workspace."""
import argparse
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

from atualizar_lowwave import ARQUIVOS


def empacotar(destino):
    raiz = Path(__file__).parent
    destino = Path(destino)
    destino.mkdir(parents=True, exist_ok=True)
    pacote = destino / "LowWave-Atualizacao.zip"
    for nome in (*ARQUIVOS, "atualizar_lowwave.py", "Atualizar LowWave.bat"):
        if not (raiz / nome).is_file():
            raise ValueError(f"Arquivo ausente: {nome}")
    guia = """ATUALIZAR O LOWWAVE

1. Feche a janela preta do app.
2. Extraia TODOS os arquivos deste ZIP (Extrair Tudo).
3. Abra Atualizar LowWave.bat, ao lado da pasta arquivos.
4. Somente na primeira vez, selecione a pasta ANTIGA do app, onde esta Abrir Coletor.bat.
5. Aguarde a mensagem de sucesso e abra seu atalho habitual.

Nas proximas atualizacoes a pasta sera lembrada. Nao abra nem copie manualmente
os itens da pasta arquivos. Sua chave e a instalacao de dependencias sao preservadas.
Se as dependencias mudarem, serao atualizadas ao abrir o app.
"""
    with ZipFile(pacote, "w", ZIP_DEFLATED) as zipado:
        for nome in ARQUIVOS:
            zipado.write(raiz / nome, "arquivos/" + nome)
        for nome in ("atualizar_lowwave.py", "Atualizar LowWave.bat"):
            zipado.write(raiz / nome, nome)
        zipado.writestr("COMO ATUALIZAR.txt", guia)
    return pacote


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--destino", default=str(Path(__file__).parent.parent))
    print(empacotar(parser.parse_args().destino))
