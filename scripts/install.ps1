$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
  npm.cmd ci
  if ($LASTEXITCODE) { throw 'Dependency installation failed' }
  npm.cmd run tauri -- build --no-bundle
  if ($LASTEXITCODE) { throw 'Release build failed' }
  $destination = Join-Path $env:LOCALAPPDATA 'Programs\Narra'
  New-Item -ItemType Directory -Force $destination | Out-Null
  Copy-Item -LiteralPath 'src-tauri\target\release\narra.exe' -Destination $destination -Force
  $entries = [Environment]::GetEnvironmentVariable('Path','User') -split ';'
  if ($entries -notcontains $destination) { [Environment]::SetEnvironmentVariable('Path', (($entries + $destination) -join ';'), 'User') }
  Write-Host "Installed in $destination. Open a new terminal to run narra."
} finally { Pop-Location }

