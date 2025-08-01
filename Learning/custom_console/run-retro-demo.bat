@echo off
REM Run Retro Terminal Demo
REM No dependencies required!

echo.
echo ===================================
echo    RETRO TERMINAL DEMO LAUNCHER    
echo ===================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Starting Retro Terminal Demo...
echo Press Q to quit the demo
echo.

REM Run the demo
node retro-terminal-demo.js

REM Return to prompt after demo exits
echo.
echo Demo exited. Thanks for trying RETRO TERMINAL!
echo.
pause