@echo off
setlocal
set "COLETOR_DIR=%~dp0"
powershell.exe -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([IO.Path]::Combine([Environment]::GetFolderPath('Desktop'),'LowWave.lnk')); $s.TargetPath=$env:ComSpec; $s.Arguments='/c '+[char]34+[char]34+[IO.Path]::Combine($env:COLETOR_DIR,'Abrir Coletor.bat')+[char]34+[char]34; $s.WorkingDirectory=$env:COLETOR_DIR; $s.Save()"
if errorlevel 1 goto erro
echo Atalho criado na Area de Trabalho.
echo Clique nele com o botao direito para fixar na barra de tarefas.
pause
exit /b 0
:erro
echo Nao foi possivel criar o atalho. Voce ainda pode abrir pelo arquivo Abrir Coletor.bat.
pause
exit /b 1
