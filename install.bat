@echo off
title CleanSlate - Extension Launcher & Setup
cls
echo ====================================================
echo           CleanSlate Extension Launcher
echo ====================================================
echo.

node scripts/launch.mjs

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Press any key to exit.
    pause >nul
)
