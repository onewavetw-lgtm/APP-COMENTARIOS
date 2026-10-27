"""Atualiza uma instalação local a partir deste pacote, sem baixar ou executar código remoto."""
from datetime import datetime
import json
import os
from pathlib import Path
import shutil
import socket
import tempfile

ARQUIVOS = (
    "coletor_de_comentarios.py", "coletor_core.py", "interface.py",
    ".streamlit/config.toml", "requirements.txt", "Abrir Coletor.bat",
    "Configurar Chave.bat", "Criar Atalho.bat", "LEIA-ME.md", "GUIA-WINDOWS.txt",
)


def instalacao_valida(pasta):
    return all((pasta / nome).is_file() for nome in
               ("coletor_de_comentarios.py", "coletor_core.py", "Abrir Coletor.bat"))


def dentro_da_pasta(pasta, relativo):
    arquivo = pasta / relativo
    if not arquivo.resolve().is_relative_to(pasta.resolve()):
        raise ValueError("Um arquivo aponta para fora da pasta. Atualização cancelada.")
    return arquivo


def aplicar_atualizacao(origem, destino):
    """Valida, guarda os arquivos anteriores e desfaz cópias se houver falha."""
    origem, destino = Path(origem).resolve(), Path(destino).resolve()
    if origem == destino:
        raise ValueError("Extraia o pacote de atualização em outra pasta, fora da instalação do app.")
    if not instalacao_valida(destino):
        raise ValueError("Escolha a pasta que contém Abrir Coletor.bat e coletor_de_comentarios.py.")
    for nome in ARQUIVOS:
        if not dentro_da_pasta(origem, nome).is_file():
            raise ValueError(f"O pacote está incompleto: falta {nome}. Extraia todos os arquivos do ZIP.")
        alvo = dentro_da_pasta(destino, nome)
        if alvo.exists() and not alvo.is_file():
            raise ValueError(f"O destino {nome} não é um arquivo. Atualização cancelada.")

    pasta_backup = dentro_da_pasta(destino, ".lowwave-backups")
    pasta_backup.mkdir(exist_ok=True)
    backup = Path(tempfile.mkdtemp(prefix=datetime.now().strftime("%Y%m%d-%H%M%S-"), dir=pasta_backup))
    existentes = []
    # Termine o backup inteiro antes de alterar a instalação.
    for nome in ARQUIVOS:
        alvo = destino / nome
        if alvo.exists():
            copia = backup / nome
            copia.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(alvo, copia)
            existentes.append(nome)
    (backup / "arquivos-anteriores.json").write_text(json.dumps(existentes), encoding="utf-8")
    requisitos_mudaram = (destino / "requirements.txt").read_bytes() != (origem / "requirements.txt").read_bytes() if (destino / "requirements.txt").exists() else True
    alterados = []
    try:
        for nome in ARQUIVOS:
            alvo = destino / nome
            alvo.parent.mkdir(parents=True, exist_ok=True)
            alterados.append(nome)
            shutil.copy2(origem / nome, alvo)
    except OSError:
        for nome in reversed(alterados):
            alvo = destino / nome
            if nome in existentes:
                shutil.copy2(backup / nome, alvo)
            else:
                alvo.unlink(missing_ok=True)
        raise
    if requisitos_mudaram:
        # O iniciador reinstala as dependências na próxima abertura, sem apagar a venv.
        marcador = dentro_da_pasta(destino, ".venv/coletor-instalado.txt")
        marcador.unlink(missing_ok=True)
    return backup


def principal():
    import tkinter as tk
    from tkinter import filedialog, messagebox
    janela = tk.Tk()
    janela.withdraw()
    janela.attributes("-topmost", True)
    try:
        # Não encerre processos: o usuário fecha a instância que está usando.
        with socket.socket() as conexao:
            conexao.settimeout(1)
            if conexao.connect_ex(("127.0.0.1", 8501)) == 0:
                messagebox.showinfo("Feche o app antes de atualizar", "A porta 8501 está em uso. Feche a janela preta do LowWave (ou o programa que usa essa porta) e execute a atualização novamente.")
                return
        registro = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "LowWave" / "instalacao.json"
        destino = None
        if registro.exists():
            try:
                candidato = Path(json.loads(registro.read_text(encoding="utf-8"))["pasta"])
                if instalacao_valida(candidato):
                    destino = candidato
            except (OSError, ValueError, KeyError, TypeError):
                pass
        if destino is None:
            messagebox.showinfo("Localizar LowWave — somente na primeira vez", "Selecione a pasta antiga do app: aquela onde está o arquivo Abrir Coletor.bat. A pasta será lembrada para as próximas atualizações.")
            escolhido = filedialog.askdirectory(title="Selecione a pasta que contém Abrir Coletor.bat", mustexist=True)
            if not escolhido:
                return
            destino = Path(escolhido).resolve()
        backup = aplicar_atualizacao(Path(__file__).parent / "arquivos", destino)
        try:
            registro.parent.mkdir(parents=True, exist_ok=True)
            registro.write_text(json.dumps({"pasta": str(destino)}, ensure_ascii=False), encoding="utf-8")
        except OSError:
            messagebox.showwarning("Atualizado, mas a pasta não foi lembrada", "A atualização foi aplicada. Não foi possível salvar o local da instalação; será necessário selecionar a pasta na próxima vez.")
        messagebox.showinfo("LowWave atualizado", f"Pronto! Sua chave foi preservada.\n\nAbra seu atalho habitual ou Abrir Coletor.bat. No navegador, pressione Ctrl+F5.\n\nCópia dos arquivos anteriores:\n{backup}")
    except (OSError, ValueError) as erro:
        messagebox.showerror("Não foi possível atualizar", str(erro))
    finally:
        janela.destroy()


if __name__ == "__main__":
    principal()
