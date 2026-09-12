# CleanSlate Easy Installer Script for Windows
# Usage: pwsh -File scripts/install-extension.ps1

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

node scripts/launch.mjs
