"""Entrada para hospedagem: streamlit run app.py."""
import os
from pathlib import Path
import runpy

# O site usa a chave informada por cada visitante, sem revelar chaves do servidor.
os.environ["LOWWAVE_WEB"] = "1"
runpy.run_path(str(Path(__file__).with_name("coletor_de_comentarios.py")), run_name="__main__")
