@echo off
title RepyNeo V1.0.2 - Preview Launcher
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0repyneo-launch.ps1"
if errorlevel 1 pause
