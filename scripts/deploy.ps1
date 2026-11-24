# Builds the site and deploys it to Whop hosting.
# Run it from the project folder:
#   powershell -ExecutionPolicy Bypass -File .\scripts\deploy.ps1
#
# What it does, in order:
#   1. Builds the site. If node_modules is damaged, it reinstalls it once and builds again.
#   2. Signs in to the Whop CLI if needed (your browser opens: click Approve).
#   3. Creates the website app on your business the first time (whop apps init), then links this folder.
#   4. Sets the secrets: a generated office passcode, the environment, and the sandbox API key you paste.
#   5. Deploys with whop apps deploy and prints the live URL.
# Every step writes to the logs folder. Secret values are never written to the logs.

param(
  [string]$AccountId = 'biz_RvgrpDnzFh7VR9',
  # The website app created on whop.com (Websites > New > Create from scratch), served at copperline-roofing-1.whop.site.
  [string]$WebsiteApp = 'app_pgxUwBJ0Y0zm63',
  [string]$Name = 'Copperline Roofing',
  [string]$Domain = 'copperline-roofing',
  [string]$Environment = 'sandbox',
  [switch]$SkipSecrets
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$logs = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

function Step($name, [scriptblock]$command) {
  $file = Join-Path $logs "$name.txt"
  Write-Host ''
  Write-Host "== $name" -ForegroundColor Cyan
  & $command 2>&1 | Tee-Object -FilePath $file | Out-Host
  $code = $LASTEXITCODE
  try { Add-Content -Path $file -Value "`nexit code: $code" -ErrorAction Stop } catch { }
  if ($code -ne 0) { Write-Host "$name failed (exit $code). See logs\$name.txt" -ForegroundColor Yellow }
  return $code
}

function SignedIn {
  Step 'whop-auth-status' { npx whop auth status --format json } | Out-Null
  $status = LastJson (Join-Path $logs 'whop-auth-status.txt')
  return ($status -and $status.loggedIn)
}

function LastJson($file) {
  $text = Get-Content -Raw -Path $file -ErrorAction SilentlyContinue
  if (-not $text) { return $null }
  $start = $text.IndexOf('{')
  $end = $text.LastIndexOf('}')
  if ($start -lt 0 -or $end -le $start) { return $null }
  try { return ($text.Substring($start, $end - $start + 1) | ConvertFrom-Json) } catch { return $null }
}

# 1. Sign in first, so the browser approval happens while you are watching -------------------
if (-not (SignedIn)) {
  Write-Host ''
  Write-Host 'Signing in to Whop. Your browser opens now: sign in if asked, then click Approve right away.' -ForegroundColor Cyan
  npx whop auth login --method oauth
  if (-not (SignedIn)) {
    Write-Host 'The Whop sign-in did not finish. Run this script again and click Approve in the browser within a minute.' -ForegroundColor Red
    exit 1
  }
}
Write-Host 'Signed in to Whop.' -ForegroundColor Green
Step 'whop-auth-account' { npx whop auth account $AccountId --format json } | Out-Null

# 2. Build ------------------------------------------------------------------------------------
$build = Step 'build' { npx vite build }
if ($build -ne 0) {
  Write-Host 'Reinstalling node_modules (the first install was cut off), then building again...' -ForegroundColor Cyan
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $root 'node_modules')
  Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $root 'package-lock.json')
  Step 'npm-install' { npm install --no-fund --no-audit } | Out-Null
  $build = Step 'build' { npx vite build }
  if ($build -ne 0) { Write-Host 'The build still fails. Stopping here; the error is in logs\build.txt.' -ForegroundColor Red; exit 1 }
}
Step 'typecheck' { npx tsc --noEmit } | Out-Null

# 3. App ---------------------------------------------------------------------------------------
$appId = $null
$link = Join-Path $root 'whop.app.json'
if (Test-Path $link) {
  try { $appId = (Get-Content -Raw $link | ConvertFrom-Json).app_id } catch { $appId = $null }
  if (-not $appId) { try { $appId = (Get-Content -Raw $link | ConvertFrom-Json).appId } catch { $appId = $null } }
  if (-not $appId) { try { $appId = (Get-Content -Raw $link | ConvertFrom-Json).id } catch { $appId = $null } }
}
if (-not $appId -and $WebsiteApp) { $appId = $WebsiteApp }
if (-not $appId) {
  # A whop.site name can already belong to someone else, so try a few in order.
  $candidates = @("$Domain-co", "$Domain-template", "$Domain-demo", ('{0}-{1}' -f $Domain, (Get-Random -Minimum 100 -Maximum 999)), $Domain)
  foreach ($candidate in $candidates) {
    $scaffold = Join-Path $env:TEMP 'copperline-scaffold'
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $scaffold
    Write-Host ''
    Write-Host "Creating the website app '$Name' at $candidate.whop.site (this also downloads Whop's starter template, which is not used)..." -ForegroundColor Cyan
    Step 'whop-apps-init' { npx whop apps init --name $Name --domain $candidate --app_type website --account_id $AccountId --dir $scaffold --format json } | Out-Null
    $initLog = Join-Path $logs 'whop-apps-init.txt'
    $found = Select-String -Path $initLog -Pattern 'app_[A-Za-z0-9]{6,}' -AllMatches -ErrorAction SilentlyContinue | ForEach-Object { $_.Matches } | Select-Object -First 1
    if ($found) {
      $appId = $found.Value
      "domain: $candidate.whop.site" | Set-Content (Join-Path $logs 'domain.txt')
      break
    }
    # DOMAIN_UNAVAILABLE: the whop.site name is taken. CREATE_FAILED: the matching app username is taken.
    if (-not (Select-String -Path $initLog -Pattern 'DOMAIN_UNAVAILABLE|CREATE_FAILED' -Quiet -ErrorAction SilentlyContinue)) { break }
    Write-Host "$candidate.whop.site can't be used, trying the next name..." -ForegroundColor Yellow
  }
  if (-not $appId) {
    # The app may exist even if init stopped early (for example while installing the starter template).
    Step 'whop-apps-list' { npx whop apps list --account_id $AccountId --app_type website --format json } | Out-Null
    $found = Select-String -Path (Join-Path $logs 'whop-apps-list.txt') -Pattern 'app_[A-Za-z0-9]{6,}' -AllMatches -ErrorAction SilentlyContinue | ForEach-Object { $_.Matches } | Select-Object -First 1
    if ($found) { $appId = $found.Value }
  }
  if (-not $appId) { Write-Host 'Could not create the app. See logs\whop-apps-init.txt.' -ForegroundColor Red; exit 1 }
}
"app_id: $appId" | Set-Content (Join-Path $logs 'app-id.txt')
Write-Host "App: $appId" -ForegroundColor Green

# 4. Secrets -----------------------------------------------------------------------------------
if (-not $SkipSecrets) {
  $passFile = Join-Path $logs 'admin-passcode.txt'
  if (Test-Path $passFile) {
    $passcode = (Get-Content -Raw $passFile).Trim()
  } else {
    $words = 'ridge', 'slate', 'cedar', 'gable', 'eave', 'shingle', 'copper', 'flash', 'truss', 'valley'
    $passcode = '{0}-{1}-{2}' -f ($words | Get-Random), ($words | Get-Random), (Get-Random -Minimum 1000 -Maximum 9999)
    $passcode | Set-Content $passFile
  }
  npx whop apps secrets set --app $appId --secret "ADMIN_PASSCODE=$passcode" --secret "WHOP_ENVIRONMENT=$Environment" | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Host 'Saved ADMIN_PASSCODE and WHOP_ENVIRONMENT.' -ForegroundColor Green } else { Write-Host 'Could not save ADMIN_PASSCODE / WHOP_ENVIRONMENT.' -ForegroundColor Yellow }

  if ($Environment -eq 'sandbox') {
    Write-Host ''
    Write-Host 'Paste your Whop SANDBOX API key and press Enter (it stays hidden; press Enter alone to skip):' -ForegroundColor Cyan
    $secure = Read-Host -AsSecureString
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
    if ($plain) {
      npx whop apps secrets set --app $appId --secret "WHOP_SANDBOX_API_KEY=$($plain.Trim())" | Out-Null
      if ($LASTEXITCODE -eq 0) { Write-Host 'Saved WHOP_SANDBOX_API_KEY.' -ForegroundColor Green } else { Write-Host 'Could not save WHOP_SANDBOX_API_KEY.' -ForegroundColor Yellow }
    }
    $plain = $null
  }
  # Log only the secret names: `secrets list` prints values too.
  $names = (npx whop apps secrets list --app $appId --format json 2>$null | Out-String)
  try { $names = (($names | ConvertFrom-Json).secrets.PSObject.Properties.Name) -join ', ' } catch { $names = 'could not read' }
  "secret names: $names" | Set-Content (Join-Path $logs 'whop-secrets-list.txt')
  Write-Host "Secrets on the app: $names" -ForegroundColor Green
}

# 5. Deploy ------------------------------------------------------------------------------------
$deploy = Step 'whop-deploy' { npx whop apps deploy --app $appId --format json }
$result = LastJson (Join-Path $logs 'whop-deploy.txt')
Write-Host ''
if ($deploy -eq 0) {
  if ($result -and $result.url) { Write-Host "Live: $($result.url)" -ForegroundColor Green }
  Write-Host 'Deployed. Tell Claude it is done.' -ForegroundColor Green
} else {
  Write-Host 'Deploy failed. Tell Claude; the details are in logs\whop-deploy.txt.' -ForegroundColor Red
}
