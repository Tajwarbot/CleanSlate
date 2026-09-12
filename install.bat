@echo off
title CleanSlate - One-Click Extension Launcher
echo ====================================================
echo           CleanSlate Extension Launcher
echo ====================================================
echo.
echo Building extension and launching browser...
echo.

node scripts/launch.mjs

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Installation/Launch encountered an issue. Press any key to exit.
    pause >nul
)
