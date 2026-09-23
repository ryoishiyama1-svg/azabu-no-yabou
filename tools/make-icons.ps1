# Generates the home-screen icons (icons/icon-*.png).
# Usage: powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1
Add-Type -AssemblyName System.Drawing
$out = Join-Path (Split-Path $PSScriptRoot -Parent) 'icons'
New-Item -ItemType Directory -Force $out | Out-Null
$fontName = 'Yu Mincho'
if (-not ((New-Object System.Drawing.Text.InstalledFontCollection).Families | Where-Object Name -eq $fontName)) { $fontName = 'MS Mincho' }
foreach ($size in 180, 192, 512) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $k = $size / 512.0
  $g.Clear([System.Drawing.Color]::FromArgb(28, 30, 46))
  $gold = [System.Drawing.Color]::FromArgb(212, 169, 60)
  $g.FillEllipse((New-Object System.Drawing.SolidBrush $gold), (56*$k), (56*$k), (400*$k), (400*$k))
  $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(200, 50, 60))), (76*$k), (76*$k), (360*$k), (360*$k))
  $font = New-Object System.Drawing.Font $fontName, ([float](250*$k)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = 'Center'; $sf.LineAlignment = 'Center'
  $g.DrawString([string][char]0x9EBB, $font, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(241, 223, 168))), (New-Object System.Drawing.RectangleF 0, (10*$k), $size, $size), $sf)
  $bmp.Save("$out\icon-$size.png", [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
"font=$fontName"
