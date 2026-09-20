@echo off
title CivicPulse - Portable Node Dev Server
cd /d "%~dp0"
echo =========================================================
echo   CivicPulse: Portable Next.js 14 Dev Environment
echo =========================================================

if not exist ".node\node.exe" (
    echo [SETUP] Portable Node.js not detected. Downloading...
    powershell -ExecutionPolicy Bypass -File setup-node-portable.ps1
)

set "PATH=%~dp0.node;%PATH%"

where node
node -v
call npm -v

if not exist "node_modules\" (
    echo [SETUP] Installing dependencies via npm...
    call npm install
)

echo [START] Launching CivicPulse on http://localhost:3000 ...
call npm run dev
pause
