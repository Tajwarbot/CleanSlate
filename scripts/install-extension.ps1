# CleanSlate Easy Installer Script for Windows
# Usage: pwsh -File scripts/install-extension.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CleanSlate 1-Click Extension Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

Write-Host "[1/2] Building CleanSlate extension..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed. Please check errors above." -ForegroundColor Red
    exit 1
}

Write-Host "[2/2] Launching browser with CleanSlate pre-loaded..." -ForegroundColor Green
node scripts/launch.mjs
