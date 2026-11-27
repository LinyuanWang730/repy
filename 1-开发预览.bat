@echo off
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
echo.
echo   Opening dev window... edit src/index.html and it reloads by itself.
echo   Keep this window open while we work. Close it to stop.
echo.
call npm run dev
pause
