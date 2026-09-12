# CleanSlate Direct Browser Installer & Launcher

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

node scripts/launch.mjs
