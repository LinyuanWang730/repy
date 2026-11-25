$ErrorActionPreference = 'SilentlyContinue'

Write-Host ''
Write-Host '  RepyNeo V1.0.2  /  Mini Program Preview'
Write-Host '  --------------------------------------------'
Write-Host '  Looking for WeChat DevTools (official previewer)...'
Write-Host ''

$project = Join-Path $PSScriptRoot 'repyneo'

$roots = @(
  "$env:ProgramFiles(x86)\Tencent",
  "$env:ProgramFiles\Tencent",
  "$env:LOCALAPPDATA\Programs"
)

# First-level folders on every drive whose name suggests the IDE.
# Chinese characters are written as \u escapes so this file stays pure ASCII.
$namePattern = 'Tencent|DevTools|wechat|\u5FAE\u4FE1|\u5F00\u53D1'
foreach ($drive in (Get-PSDrive -PSProvider FileSystem).Root) {
  Get-ChildItem -LiteralPath $drive -Directory |
    Where-Object { $_.Name -match $namePattern } |
    ForEach-Object { $roots += $_.FullName }
}

$cli = $null

# 1) cli.bat on PATH
$found = Get-Command 'cli.bat' -ErrorAction SilentlyContinue
if ($found) { $cli = $found.Source }

# 2) inside candidate install roots
if (-not $cli) {
  foreach ($r in ($roots | Select-Object -Unique)) {
    if (Test-Path -LiteralPath $r) {
      $hit = Get-ChildItem -LiteralPath $r -Filter 'cli.bat' -Recurse -Depth 3 -File -ErrorAction SilentlyContinue |
        Select-Object -First 1
      if ($hit) { $cli = $hit.FullName; break }
    }
  }
}

if (-not $cli) {
  Write-Host '  [!] WeChat DevTools was not found on this PC.'
  Write-Host '  A .bat alone cannot render a mini program - the official previewer does.'
  Write-Host '  Opening the official download page...'
  Start-Process 'https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html'
  exit 1
}

Write-Host "  Found   : $cli"
Write-Host "  Project : $project"
Write-Host ''
Write-Host '  If it says "service port disabled": open DevTools -> Settings ->'
Write-Host '  Security Settings -> turn Service Port ON, then run this again.'
Write-Host '  Opening WeChat DevTools (scan the QR code if asked)...'
Write-Host ''

& $cli open --project $project

Write-Host ''
Write-Host '  Done. This window closes in 8 seconds.'
Start-Sleep -Seconds 8
