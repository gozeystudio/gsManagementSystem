@echo off
title Nibras Educational Complex - School Management System
cd /d "%~dp0"

where node >nul 2>nul
if not %errorlevel%==0 goto nonode

echo ============================================================
echo   NIBRAS EDUCATIONAL COMPLEX
echo   "Knowledge is Light"
echo   Starting School Management System...
echo ============================================================
echo.
goto loop

:nonode
echo.
echo ============================================================
echo   Node.js was not found on this computer.
echo   Please install it first - it is a one-time step.
echo   Go to nodejs.org and download the LTS version.
echo   After installing, restart the computer, then try again.
echo ============================================================
echo.
pause
exit /b 1

:loop
start "" http://localhost:3000
node server.js
echo.
echo Server stopped or is restarting...
timeout /t 2 >nul
goto loop
