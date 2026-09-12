# CleanSlate Direct Browser Installer & Launcher
# Ensures extension is built and opens in browser cleanly

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   CleanSlate Extension Direct Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build extension
Write-Host "[1/3] Building CleanSlate extension..." -ForegroundColor Yellow
npm run build

$dist = Join-Path $root "dist"
$manifest = Join-Path $dist "manifest.json"

if (-not (Test-Path $manifest)) {
    Write-Host "Error: dist/manifest.json not found." -ForegroundColor Red
    exit 1
}

# Step 2: Find Browser
$brave = "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

$browserExe = $null
$browserName = ""

if (Test-Path $brave) {
    $browserExe = $brave
    $browserName = "Brave"
} elseif (Test-Path $chrome) {
    $browserExe = $chrome
    $browserName = "Google Chrome"
} elseif (Test-Path $edge) {
    $browserExe = $edge
    $browserName = "Microsoft Edge"
}

if (-not $browserExe) {
    Write-Host "No supported browser found." -ForegroundColor Red
    exit 1
}

Write-Host "[2/3] Using browser: $browserName ($browserExe)" -ForegroundColor Green

# Step 3: Launch with dedicated profile & pre-loaded extension
$profileDir = Join-Path $root ".cleanslate-profile"
Write-Host "[3/3] Launching $browserName with CleanSlate pre-installed..." -ForegroundColor Yellow

$argList = @(
    "--user-data-dir=`"$profileDir`"",
    "--disable-extensions-except=`"$dist`"",
    "--load-extension=`"$dist`"",
    "--no-first-run",
    "--no-default-browser-check",
    "chrome://extensions"
)

Start-Process -FilePath $browserExe -ArgumentList $argList

Write-Host ""
Write-Host "✅ Launched $browserName successfully with CleanSlate installed!" -ForegroundColor Green
Write-Host "Look at the extensions list in the newly opened browser window." -ForegroundColor Cyan
