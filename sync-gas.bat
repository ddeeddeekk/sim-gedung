@echo off
title SIM-GEDUNG UNSRI - Sync Google Apps Script
cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0sync-gas.ps1"
pause
