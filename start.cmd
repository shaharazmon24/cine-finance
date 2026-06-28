@echo off
cd /d "%~dp0"
node server.js
if errorlevel 1 (
  echo.
  echo Node.js not found. Install from https://nodejs.org then run again.
  pause
)
