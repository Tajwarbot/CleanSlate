Add-Type -AssemblyName System.Drawing

$sizes = @(16, 32, 48, 128)
$iconsDir = Join-Path $PSScriptRoot "..\icons"
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir | Out-Null
}

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap([int]$size, [int]$size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    # Background gradient
    $rect = New-Object System.Drawing.Rectangle(0, 0, [int]$size, [int]$size)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 14, 165, 233), # Cyan
        [System.Drawing.Color]::FromArgb(255, 99, 102, 241), # Indigo
        45.0
    )
    $g.FillEllipse($brush, $rect)

    # Draw Inner Symbol ('C' arc)
    $penWidth = [float][Math]::Max(2.0, [double]$size / 8.0)
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, $penWidth)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    
    $margin = [int][Math]::Max(3, [double]$size / 4.0)
    $w = [int]($size - (2 * $margin))
    $arcRect = New-Object System.Drawing.Rectangle($margin, $margin, $w, $w)
    $g.DrawArc($pen, $arcRect, [float]45.0, [float]270.0)

    $outPath = Join-Path $iconsDir "icon-$size.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $pen.Dispose()
    $brush.Dispose()
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated $outPath"
}
