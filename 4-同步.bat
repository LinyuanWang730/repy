@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo   Sync with the shared repo
echo   ------------------------------------------------------------
echo   Run this BEFORE you start editing AND AFTER you finish.
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo   Git is not installed. Get it from https://git-scm.com/download/win
  echo.
  pause
  exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo   This folder is not a git repository.
  echo.
  pause
  exit /b 1
)

rem ---------- 1. commit local changes ----------
git add -A
git diff --cached --quiet
if errorlevel 1 (
  echo   [1/3] Changed files:
  git -c core.quotepath=false diff --cached --name-status
  echo.
  set "MSG="
  set /p "MSG=  What did you change? (Enter = auto timestamp): "
  if "!MSG!"=="" set "MSG=auto commit %date% %time%"
  git commit -q -m "!MSG!"
  if errorlevel 1 (
    echo.
    echo   Commit failed. Send me the red lines above.
    echo.
    pause
    exit /b 1
  )
  echo   Committed.
) else (
  echo   [1/3] Nothing new to commit.
)
echo.

rem ---------- 2. pull ----------
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo   [2/3] No shared repo configured - nothing to pull or push.
  echo   Your work is saved on this machine only.
  echo.
  pause
  exit /b 0
)

echo   [2/3] Pulling from shared repo...
git pull --rebase --autostash origin main
if errorlevel 1 (
  echo.
  echo   Pull FAILED.
  echo.
  echo   - If it says conflict: open the file, remove the conflict
  echo     markers git left in it, then run:  git rebase --continue
  echo   - If it says cannot read tree / bad object: the iCloud copy
  echo     is damaged. Tell me before you touch anything.
  echo.
  echo   Your own commit is safe on this machine.
  echo.
  pause
  exit /b 1
)

rem ---------- 3. push ----------
echo.
echo   [3/3] Pushing...
git push origin main
if errorlevel 1 (
  echo.
  echo   Push FAILED. The shared repo folder may be missing.
  echo   Your commit is safe on this machine - fix the path and run me again.
  echo.
  pause
  exit /b 1
)

echo.
echo   Synced. Last 3 commits:
git log --oneline -3
echo.
echo   If the shared repo lives on iCloud, wait for the sync icon to
echo   stop before you open the other machine.
echo.
pause
