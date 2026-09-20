@echo off
title CivicPulse GitHub Push
color 0A
echo ========================================================
echo   CivicPulse - Pushing local codebase to GitHub
echo   Repository: https://github.com/kkgdharshan/civic-issue-tracker.git
echo ========================================================
echo.
cd /d "d:\linkedn projects"
git push -u origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Code successfully pushed to GitHub!
    echo Visit: https://github.com/kkgdharshan/civic-issue-tracker
) else (
    echo [ERROR] Push failed. If prompted, please authorize GitHub in your browser.
)
echo.
pause
