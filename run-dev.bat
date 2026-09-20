@echo off
title CivicPulse - Local Dev Server
cd /d "%~dp0"
echo ===================================================
echo   CivicPulse: High-Concurrency Civic Issue Tracker
echo ===================================================
echo Checking Node.js environment...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [NOTICE] Node.js was not found in PATH.
    echo Please ensure Node.js LTS is installed and in your environment PATH.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [SETUP] Installing dependencies via npm...
    call npm install
)

echo [START] Launching CivicPulse on http://localhost:3000 ...
call npm run dev
pause
