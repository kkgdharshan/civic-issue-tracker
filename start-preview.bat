@echo off
title CivicPulse - Live Preview Server
cd /d "%~dp0"
echo Starting CivicPulse Live Radar & Incident Mesh...
python serve-preview.py
pause
