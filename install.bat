@echo off
title CleanSlate Extension Launcher
cls
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\install-direct.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Press any key to exit.
    pause >nul
)
