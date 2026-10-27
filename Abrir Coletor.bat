@echo off
setlocal
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" goto verificar
echo Preparando o app. Na primeira vez e necessario acesso a internet.
py -3.12 -m venv .venv
if errorlevel 1 goto sem_python
:verificar
if exist ".venv\coletor-instalado.txt" goto iniciar
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto erro
echo ok>".venv\coletor-instalado.txt"
:iniciar
".venv\Scripts\python.exe" -m streamlit run coletor_de_comentarios.py --server.address 127.0.0.1 --server.port 8501 --server.headless false --server.showEmailPrompt false --browser.gatherUsageStats false
if errorlevel 1 goto erro
exit /b 0
:sem_python
echo Instale o Python 3.12 para Windows, incluindo o Python Launcher.
echo Depois abra este arquivo novamente.
pause
exit /b 1
:erro
echo O app nao iniciou. Confira a conexao e a mensagem acima.
echo Se a instalacao foi interrompida, apague somente a pasta .venv e tente novamente.
pause
exit /b 1
