@echo off
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
echo.
echo   Closing running app instances...
taskkill /F /IM "ÑµÁ·¼ÇÂ¼Éú³ÉÆ÷.exe" >nul 2>&1
echo   Building...
echo.
call npm run build
echo.
pause
