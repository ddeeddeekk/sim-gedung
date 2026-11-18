@echo off
title SIM-GEDUNG UNSRI - Control Center
cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0menu.ps1"
pause
