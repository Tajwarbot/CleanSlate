Add-Type -AssemblyName System.Drawing

$sizes = @(16, 32, 48, 128)
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$sourcePath = Join-Path $root "assets\cleanslate-logo.png"
$iconsDir = Join-Path $root "icons"

if (-not (Test-Path $sourcePath)) {
    throw "Logo source not found: $sourcePath"
}

if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir | Out-Null
}

$source = [System.Drawing.Image]::FromFile($sourcePath)
try {
    foreach ($size in $sizes) {
        $bitmap = New-Object System.Drawing.Bitmap([int]$size, [int]$size)
        $bitmap.SetResolution(96, 96)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage($source, 0, 0, $size, $size)

        $outPath = Join-Path $iconsDir "icon-$size.png"
        $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $graphics.Dispose()
        $bitmap.Dispose()
        Write-Host "Generated $outPath"
    }
}
finally {
    $source.Dispose()
}
