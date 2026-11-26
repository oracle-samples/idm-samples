@echo off
cd /d %~dp0
powershell -NoProfile -Command "$bridge = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'bridge\run-bridge.bat' -PassThru -WindowStyle Normal; try { & node app\src\server.js; exit $LASTEXITCODE } finally { if (!$bridge.HasExited) { & taskkill /PID $bridge.Id /T /F > $null 2>&1 } }"
