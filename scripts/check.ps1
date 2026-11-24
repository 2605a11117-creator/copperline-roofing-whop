# Installs dependencies, checks types, builds the site and signs in to the Whop CLI.
# Run it from the project folder:
#   powershell -ExecutionPolicy Bypass -File .\scripts\check.ps1
# Every step writes its output to the logs folder, so the results can be read afterwards.
# Nothing here asks for or stores an API key.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$logs = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

function Step($name, [scriptblock]$command) {
  $file = Join-Path $logs "$name.txt"
  Write-Host ""
  Write-Host "== $name" -ForegroundColor Cyan
  & $command 2>&1 | Tee-Object -FilePath $file | Out-Host
  $code = $LASTEXITCODE
  Add-Content -Path $file -Value "`nexit code: $code"
  if ($code -ne 0) { Write-Host "$name failed (exit $code). See logs\$name.txt" -ForegroundColor Yellow }
  return $code
}

$nodeVersion = (node -v) 2>$null
if (-not $nodeVersion) {
  Write-Host 'Node.js is not installed. Install the LTS version from https://nodejs.org and run this again.' -ForegroundColor Red
  exit 1
}
$major = [int]($nodeVersion.TrimStart('v').Split('.')[0])
if ($major -lt 22) {
  Write-Host "Node.js $nodeVersion is too old. Install version 22 or newer from https://nodejs.org." -ForegroundColor Red
  exit 1
}
"node $nodeVersion" | Set-Content (Join-Path $logs 'versions.txt')
"npm $(npm -v)" | Add-Content (Join-Path $logs 'versions.txt')

Step 'npm-install' { npm install --no-fund --no-audit } | Out-Null
Step 'typecheck' { npx tsc --noEmit } | Out-Null
Step 'build' { npx vite build } | Out-Null
Step 'whop-version' { npx whop --version } | Out-Null
Step 'whop-manifest' { npx whop --llms-full } | Out-Null

$status = Step 'whop-auth-status' { npx whop auth status }
if ($status -ne 0) {
  Write-Host ''
  Write-Host 'Signing in to Whop. Your browser will open: click Approve there.' -ForegroundColor Cyan
  npx whop login --method oauth
  Step 'whop-auth-status' { npx whop auth status } | Out-Null
}
Step 'whop-apps-list' { npx whop apps list --format json } | Out-Null

Write-Host ''
Write-Host 'Done. The results are in the logs folder.' -ForegroundColor Green
