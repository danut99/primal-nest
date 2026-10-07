Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path $PSScriptRoot -Parent
$sourceDir = Join-Path $projectRoot 'output/imagegen/interface-icons'
$targetDir = Join-Path $projectRoot 'public/icons/actions'
New-Item -ItemType Directory -Force $targetDir | Out-Null
Get-ChildItem -LiteralPath $sourceDir -Filter '*.png' | ForEach-Object {
    $source = [System.Drawing.Bitmap]::FromFile($_.FullName)
    $target = New-Object System.Drawing.Bitmap(128,128)
    $graphics = [System.Drawing.Graphics]::FromImage($target)
    try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($source,0,0,128,128)
        $target.Save((Join-Path $targetDir $_.Name),[System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $target.Dispose(); $source.Dispose() }
}
