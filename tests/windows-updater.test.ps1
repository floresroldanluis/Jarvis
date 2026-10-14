$ErrorActionPreference='Stop'
$jarvisOriginal=Split-Path $PSScriptRoot
$jarvisTestRoot=Join-Path $env:TEMP ('jarvis-updater-check-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $jarvisTestRoot | Out-Null
foreach($jarvisCase in @('success','rollback')){
 $global:jarvisCaseRoot=Join-Path $jarvisTestRoot $jarvisCase
 $global:jarvisPayload=Join-Path $jarvisTestRoot ($jarvisCase+'-payload')
 New-Item -ItemType Directory -Force $global:jarvisCaseRoot,$global:jarvisPayload,(Join-Path $global:jarvisCaseRoot 'node_modules'),(Join-Path $global:jarvisCaseRoot 'memory'),(Join-Path $global:jarvisCaseRoot 'data'),(Join-Path $global:jarvisCaseRoot 'workspace') | Out-Null
 Copy-Item -LiteralPath (Join-Path $jarvisOriginal 'Update-Windows.ps1') -Destination $global:jarvisCaseRoot
 '{"name":"jarvis-os","version":"0.9.0"}' | Set-Content (Join-Path $global:jarvisCaseRoot 'package.json')
 'original-server' | Set-Content (Join-Path $global:jarvisCaseRoot 'server.mjs')
 'private-memory' | Set-Content (Join-Path $global:jarvisCaseRoot 'memory/keep.md')
 'private-data' | Set-Content (Join-Path $global:jarvisCaseRoot 'data/keep.txt')
 'private-document' | Set-Content (Join-Path $global:jarvisCaseRoot 'workspace/keep.txt')
 'old-modules' | Set-Content (Join-Path $global:jarvisCaseRoot 'node_modules/keep.txt')
 'param([switch]$Background); "restored" | Set-Content (Join-Path $PSScriptRoot "restored.txt")' | Set-Content (Join-Path $global:jarvisCaseRoot 'Start-Jarvis.ps1')
 Copy-Item -LiteralPath (Join-Path $jarvisOriginal 'package.json'),(Join-Path $jarvisOriginal 'package-lock.json') -Destination $global:jarvisPayload
 foreach($jarvisFixtureName in @('package.json','package-lock.json')){
  $jarvisFixtureFile=Join-Path $global:jarvisPayload $jarvisFixtureName
  $jarvisOriginalVersion=(Get-Content (Join-Path $jarvisOriginal 'package.json') -Raw | ConvertFrom-Json).version
  [IO.File]::WriteAllText($jarvisFixtureFile,[IO.File]::ReadAllText($jarvisFixtureFile).Replace($jarvisOriginalVersion,'1.0.0'))
 }
 'updated-server' | Set-Content (Join-Path $global:jarvisPayload 'server.mjs')
 if($jarvisCase -eq 'success'){'param([switch]$Background); "started" | Set-Content (Join-Path $PSScriptRoot "started.txt")' | Set-Content (Join-Path $global:jarvisPayload 'Start-Jarvis.ps1')}else{'param([switch]$Background); throw "simulated-start-failure"' | Set-Content (Join-Path $global:jarvisPayload 'Start-Jarvis.ps1')}
 $global:jarvisFixtureZip=Join-Path $jarvisTestRoot ($jarvisCase+'.zip')
 Compress-Archive -Path "$global:jarvisPayload/*" -DestinationPath $global:jarvisFixtureZip
 $global:jarvisFixtureHash=(Get-FileHash -LiteralPath $global:jarvisFixtureZip -Algorithm SHA256).Hash
 function Invoke-RestMethod { param($Uri,$Headers,$TimeoutSec) if($Uri -like '*api.github.com*'){return [pscustomobject]@{tag_name='v1.0.0';assets=@([pscustomobject]@{name='jarvis-windows.zip';browser_download_url='https://github.com/floresroldanluis/Jarvis/releases/download/v1.0.0/jarvis-windows.zip'},[pscustomobject]@{name='SHA256SUMS.txt';browser_download_url='https://github.com/floresroldanluis/Jarvis/releases/download/v1.0.0/SHA256SUMS.txt'})}};return [pscustomobject]@{busy=$false} }
 function Invoke-WebRequest { param($Uri,$OutFile,[switch]$UseBasicParsing) if($OutFile){Copy-Item -LiteralPath $global:jarvisFixtureZip -Destination $OutFile}else{return [pscustomobject]@{Content="$global:jarvisFixtureHash  jarvis-windows.zip"}} }
 function Get-NetTCPConnection { param($LocalPort,$State,$ErrorAction) return [pscustomobject]@{OwningProcess=424242} }
 function Get-CimInstance { param($ClassName,$Filter) return [pscustomobject]@{CommandLine=('node "'+(Join-Path $global:jarvisCaseRoot 'server.mjs')+'"')} }
 function Stop-Process { param($Id) if($Id -ne 424242){throw 'Unexpected process id'} }
 function Start-Sleep { param($Seconds) }
 try { & (Join-Path $global:jarvisCaseRoot 'Update-Windows.ps1'); if($jarvisCase -eq 'rollback'){throw 'Rollback test did not fail'} } catch { if($jarvisCase -ne 'rollback' -or $_.ToString() -notmatch 'simulated-start-failure'){throw} }
 $jarvisVersion=(Get-Content (Join-Path $global:jarvisCaseRoot 'package.json') -Raw | ConvertFrom-Json).version
 if($jarvisVersion -ne $(if($jarvisCase -eq 'success'){'1.0.0'}else{'0.9.0'})){throw "Wrong resulting version in $jarvisCase"}
 foreach($jarvisKeep in @('data/keep.txt','memory/keep.md','workspace/keep.txt')){if(!(Test-Path -LiteralPath (Join-Path $global:jarvisCaseRoot $jarvisKeep))){throw "Private file lost: $jarvisKeep"}}
 if($jarvisCase -eq 'rollback' -and !(Test-Path (Join-Path $global:jarvisCaseRoot 'node_modules/keep.txt'))){throw 'Original dependencies not restored'}
 Write-Output "PASS $jarvisCase`: preserved private folders and correct app/dependency version."
}
