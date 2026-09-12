@echo off
title CleanSlate Extension Installer
cls
node "%~dp0scripts\launch.mjs"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Press any key to exit.
    pause >nul
)
