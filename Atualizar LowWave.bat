@echo off
setlocal
cd /d "%~dp0"
py -3.12 atualizar_lowwave.py
if errorlevel 1 goto erro
exit /b 0
:erro
echo Nao foi possivel iniciar o atualizador. Confira se o Python 3.12 esta instalado e se todos os arquivos do ZIP foram extraidos.
pause
exit /b 1
