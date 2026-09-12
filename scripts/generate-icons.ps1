Add-Type -AssemblyName System.Drawing

$sizes = @(16, 32, 48, 128)
$iconsDir = Join-Path $PSScriptRoot "..\icons"
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir | Out-Null
}

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap([int]$size, [int]$size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None

    # Brutalist mark: a near-black square, an angular white C, and a red
    # deletion slash. The hard geometry stays legible at 16px.
    $background = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 10, 10, 10))
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillRectangle($background, 0, 0, $size, $size)

    $unit = [float]($size / 8.0)
    $points = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new($unit * 6.5, $unit * 1.0),
        [System.Drawing.PointF]::new($unit * 2.4, $unit * 1.0),
        [System.Drawing.PointF]::new($unit * 1.0, $unit * 2.4),
        [System.Drawing.PointF]::new($unit * 1.0, $unit * 5.6),
        [System.Drawing.PointF]::new($unit * 2.4, $unit * 7.0),
        [System.Drawing.PointF]::new($unit * 6.5, $unit * 7.0),
        [System.Drawing.PointF]::new($unit * 5.0, $unit * 5.5),
        [System.Drawing.PointF]::new($unit * 3.6, $unit * 5.5),
        [System.Drawing.PointF]::new($unit * 3.0, $unit * 4.9),
        [System.Drawing.PointF]::new($unit * 3.0, $unit * 3.1),
        [System.Drawing.PointF]::new($unit * 3.6, $unit * 2.5),
        [System.Drawing.PointF]::new($unit * 5.0, $unit * 2.5)
    )
    $g.FillPolygon($white, $points)

    $slashWidth = [float][Math]::Max(2.0, [double]$size / 8.0)
    $slash = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 239, 68, 68), $slashWidth)
    $slash.StartCap = [System.Drawing.Drawing2D.LineCap]::Square
    $slash.EndCap = [System.Drawing.Drawing2D.LineCap]::Square
    $g.DrawLine($slash, [float]($size * 0.62), [float]($size * 0.18), [float]($size * 0.82), [float]($size * 0.82))

    $outPath = Join-Path $iconsDir "icon-$size.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $slash.Dispose()
    $background.Dispose()
    $white.Dispose()
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated $outPath"
}
