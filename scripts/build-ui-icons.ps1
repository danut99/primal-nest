# Keep full-resolution originals and ship small transparent UI assets.
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path $PSScriptRoot -Parent
$sourceDir = Join-Path $projectRoot 'output/imagegen/ui'
$targetDir = Join-Path $projectRoot 'public/icons/ui'
New-Item -ItemType Directory -Force $targetDir | Out-Null
Get-ChildItem -LiteralPath $sourceDir -Filter '*.png' | ForEach-Object {
    $size = if ($_.BaseName -eq 'logo') { 256 } else { 128 }
    $source = [System.Drawing.Bitmap]::FromFile($_.FullName)
    $target = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($target)
    try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($source, 0, 0, $size, $size)
        $target.Save((Join-Path $targetDir $_.Name), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $target.Dispose()
        $source.Dispose()
    }
}
