# CivicPulse Portable Node.js LTS Downloader (Zero-Admin, Zero-UAC)
# Installs a localized Node.js LTS runtime directly into d:\linkedn projects\.node

$NodeVersion = "v20.18.0"
$ZipUrl = "https://nodejs.org/dist/$NodeVersion/node-$NodeVersion-win-x64.zip"
$TargetDir = "$PSScriptRoot\.node"
$ZipFile = "$PSScriptRoot\node-temp.zip"

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "  CivicPulse: Installing Portable Node.js $NodeVersion   " -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

if (Test-Path "$TargetDir\node.exe") {
    Write-Host "[OK] Portable Node.js is already installed at $TargetDir" -ForegroundColor Green
    & "$TargetDir\node.exe" -v
    & "$TargetDir\npm.cmd" -v
    exit 0
}

Write-Host "[1/3] Downloading Node.js LTS archive from official mirror..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $ZipUrl -OutFile $ZipFile -UseBasicParsing

Write-Host "[2/3] Extracting archive..." -ForegroundColor Yellow
Expand-Archive -Path $ZipFile -DestinationPath "$PSScriptRoot\.node-extract" -Force

$ExtractedFolder = Get-ChildItem "$PSScriptRoot\.node-extract" -Directory | Select-Object -First 1
Move-Item -Path $ExtractedFolder.FullName -Destination $TargetDir -Force

Remove-Item -Path "$PSScriptRoot\.node-extract" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path $ZipFile -Force -ErrorAction SilentlyContinue

Write-Host "[3/3] Verifying portable installation..." -ForegroundColor Green
& "$TargetDir\node.exe" -v
& "$TargetDir\npm.cmd" -v

Write-Host "`n[SUCCESS] Node.js is ready! Run .\run-dev-portable.bat to start Next.js." -ForegroundColor Green
