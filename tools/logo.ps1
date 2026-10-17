# Gera os icones do app a partir da imagem do logo (PNG/WebP/JPG quadrado, logo sobre fundo escuro).
# Uso: powershell -File tools\logo.ps1 -Origem caminho\do\logo.webp
param([Parameter(Mandatory = $true)][string]$Origem)
Add-Type -AssemblyName PresentationCore, PresentationFramework, WindowsBase
$ErrorActionPreference = "Stop"
$destino = Join-Path $PSScriptRoot "..\icons"

$fs = [IO.File]::OpenRead($Origem)
$fonte = [Windows.Media.Imaging.BitmapDecoder]::Create($fs, 'PreservePixelFormat', 'OnLoad').Frames[0]
$fs.Close()
$lado = $fonte.PixelWidth

# Recorte: "tile" e o quadrado arredondado do logo; "cheio" e a area interna, sem bordas, para icones mascaraveis.
function Gera($nome, $tam, $x0, $x1, $raio) {
  $esc = $tam / ($x1 - $x0)
  $vis = New-Object Windows.Media.DrawingVisual
  [Windows.Media.RenderOptions]::SetBitmapScalingMode($vis, 'HighQuality')
  $dc = $vis.RenderOpen()
  if ($raio -gt 0) {
    $r = $tam * $raio
    $dc.PushClip((New-Object Windows.Media.RectangleGeometry((New-Object Windows.Rect(0, 0, $tam, $tam)), $r, $r)))
  }
  $dc.DrawImage($fonte, (New-Object Windows.Rect((-$x0 * $esc), (-$x0 * $esc), ($lado * $esc), ($lado * $esc))))
  if ($raio -gt 0) { $dc.Pop() }
  $dc.Close()
  $rtb = New-Object Windows.Media.Imaging.RenderTargetBitmap($tam, $tam, 96, 96, [Windows.Media.PixelFormats]::Pbgra32)
  $rtb.Render($vis)
  $enc = New-Object Windows.Media.Imaging.PngBitmapEncoder
  $enc.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($rtb))
  $out = [IO.File]::Create((Join-Path $destino $nome))
  $enc.Save($out); $out.Close()
}

$t0 = [int]($lado * 0.050); $t1 = [int]($lado * 0.952)   # quadrado arredondado
$c0 = [int]($lado * 0.13); $c1 = [int]($lado * 0.87)     # interior cheio
Gera "icon-192.png" 192 $t0 $t1 0.2
Gera "icon-512.png" 512 $t0 $t1 0.2
Gera "logo.png" 256 $t0 $t1 0.2
Gera "maskable-512.png" 512 $c0 $c1 0
Gera "apple-touch-icon.png" 180 $c0 $c1 0
Write-Output "icones gerados em $destino"
