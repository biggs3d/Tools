@echo off
REM Simple double-click launcher for Retro Terminal Demo
color 0A
title RETRO TERMINAL LAUNCHER
node retro-terminal-demo.js || (
    echo.
    echo ERROR: Node.js not found! Install from nodejs.org
    pause
)