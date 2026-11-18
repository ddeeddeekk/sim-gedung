@echo off
title SIM-GEDUNG UNSRI - Local Server
cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0start-dev.ps1"
pause
