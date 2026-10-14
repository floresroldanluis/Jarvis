param([switch]$Background)
$ErrorActionPreference = 'Stop'
$jarvisRoot = $PSScriptRoot
$jarvisUrl = 'http://127.0.0.1:4317'
$jarvisRunning = $false
try { $jarvisResponse = Invoke-RestMethod "$jarvisUrl/api/state" -TimeoutSec 2; $jarvisRunning = $null -ne $jarvisResponse.settings } catch {}
if (!$jarvisRunning) {
  New-Item -ItemType Directory -Force -Path (Join-Path $jarvisRoot 'data') | Out-Null
  $jarvisNode = (Get-Command node.exe).Source
  Start-Process -FilePath $jarvisNode -ArgumentList @(('"' + (Join-Path $jarvisRoot 'server.mjs') + '"')) -WorkingDirectory $jarvisRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $jarvisRoot 'data/server.log') -RedirectStandardError (Join-Path $jarvisRoot 'data/server-error.log')
  $jarvisReady = $false
  for ($jarvisAttempt = 0; $jarvisAttempt -lt 20; $jarvisAttempt++) {
    Start-Sleep -Milliseconds 500
    try { Invoke-RestMethod "$jarvisUrl/api/state" -TimeoutSec 1 | Out-Null; $jarvisReady = $true; break } catch {}
  }
  if (!$jarvisReady) { throw 'JARVIS no pudo arrancar. Revisa data/server-error.log.' }
}
if (!$Background) { Start-Process $jarvisUrl }
