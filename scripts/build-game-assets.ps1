# Full generated originals stay in output; runtime artwork retains its alpha.
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path $PSScriptRoot -Parent
$sourceRoot = Join-Path $projectRoot 'output/imagegen/game-assets'
$targetRoot = Join-Path $projectRoot 'public/art'
foreach ($category in @('characters', 'eggs', 'items', 'relics')) {
    $sourceDir = Join-Path $sourceRoot $category
    $targetDir = Join-Path $targetRoot $category
    New-Item -ItemType Directory -Force $targetDir | Out-Null
    $size = if ($category -in @('characters', 'eggs')) { 256 } else { 128 }
    Get-ChildItem -LiteralPath $sourceDir -Filter '*.png' | ForEach-Object {
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
}
