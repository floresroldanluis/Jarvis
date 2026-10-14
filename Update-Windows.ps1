param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
$jarvisRoot=$PSScriptRoot
$jarvisRepo='floresroldanluis/Jarvis'
$jarvisHeaders=@{'User-Agent'='JarvisOS-Windows-Updater';Accept='application/vnd.github+json'}
$jarvisRelease=Invoke-RestMethod "https://api.github.com/repos/$jarvisRepo/releases/latest" -Headers $jarvisHeaders
$jarvisCurrent=(Get-Content -LiteralPath (Join-Path $jarvisRoot 'package.json') -Raw | ConvertFrom-Json).version
if ($jarvisRelease.tag_name -notmatch '^v(\d+\.\d+\.\d+)$') { throw 'La publicación no tiene una versión estable válida.' }
$jarvisTarget=$Matches[1]
if ([version]$jarvisTarget -le [version]$jarvisCurrent) { Write-Output 'Ya tienes la versión más reciente.'; exit 0 }
if ($CheckOnly) { Write-Output "Versión disponible: $jarvisTarget"; exit 0 }
$jarvisState=Invoke-RestMethod 'http://127.0.0.1:4317/api/state' -TimeoutSec 3
if ($jarvisState.busy) { throw 'Espera a que termine la tarea antes de actualizar.' }
$jarvisZipAsset=@($jarvisRelease.assets | Where-Object name -eq 'jarvis-windows.zip')
$jarvisHashAsset=@($jarvisRelease.assets | Where-Object name -eq 'SHA256SUMS.txt')
if ($jarvisZipAsset.Count -ne 1 -or $jarvisHashAsset.Count -ne 1) { throw 'Falta el paquete de actualización o su suma SHA256.' }
$jarvisPrefix="https://github.com/$jarvisRepo/releases/download/$($jarvisRelease.tag_name)/"
foreach ($jarvisAsset in @($jarvisZipAsset[0],$jarvisHashAsset[0])) { if (!$jarvisAsset.browser_download_url.StartsWith($jarvisPrefix,[StringComparison]::Ordinal)) { throw 'La descarga no pertenece al repositorio oficial.' } }
$jarvisStage=Join-Path $jarvisRoot ('data/update-'+[guid]::NewGuid().ToString('N'))
$jarvisSource=Join-Path $jarvisStage 'source'
$jarvisBackup=Join-Path $jarvisStage 'backup'
New-Item -ItemType Directory -Force $jarvisSource,$jarvisBackup | Out-Null
$jarvisZip=Join-Path $jarvisStage 'release.zip'
Invoke-WebRequest $jarvisZipAsset[0].browser_download_url -OutFile $jarvisZip -UseBasicParsing
$jarvisHashText=(Invoke-WebRequest $jarvisHashAsset[0].browser_download_url -UseBasicParsing).Content
$jarvisHashMatch=[regex]::Match($jarvisHashText,'(?im)^\s*([a-f0-9]{64})\s+\*?jarvis-windows\.zip\s*$')
if (!$jarvisHashMatch.Success -or (Get-FileHash -LiteralPath $jarvisZip -Algorithm SHA256).Hash -ne $jarvisHashMatch.Groups[1].Value) { throw 'La descarga no coincide con SHA256. No se instaló.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$jarvisArchive=[IO.Compression.ZipFile]::OpenRead($jarvisZip)
try { foreach ($jarvisEntry in $jarvisArchive.Entries) {
 $jarvisName=$jarvisEntry.FullName.Replace('\','/')
 if ($jarvisName -match '(^|/)(\.\.?)(/|$)|^[a-zA-Z]:|^/|^(data|memory|workspace|node_modules|\.git)/|(^|/)\.env') { throw "Ruta rechazada en la actualización: $jarvisName" }
 $jarvisResolved=[IO.Path]::GetFullPath((Join-Path $jarvisSource $jarvisName))
 if (!$jarvisResolved.StartsWith($jarvisSource+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Ruta de actualización fuera de la carpeta temporal.' }
} } finally { $jarvisArchive.Dispose() }
Expand-Archive -LiteralPath $jarvisZip -DestinationPath $jarvisSource
$jarvisPackage=Get-Content -LiteralPath (Join-Path $jarvisSource 'package.json') -Raw | ConvertFrom-Json
if ($jarvisPackage.name -ne 'jarvis-os' -or $jarvisPackage.version -ne $jarvisTarget -or !(Test-Path -LiteralPath (Join-Path $jarvisSource 'server.mjs'))) { throw 'El paquete descargado no corresponde a JARVIS o a la versión anunciada.' }
Push-Location $jarvisSource
try { & npm.cmd ci --ignore-scripts; if ($LASTEXITCODE -ne 0) { throw 'No se pudieron preparar las dependencias.' } } finally { Pop-Location }
# Stage is ready before the running instance is interrupted. Preserve all private folders.
$jarvisState=Invoke-RestMethod 'http://127.0.0.1:4317/api/state' -TimeoutSec 3
if ($jarvisState.busy) { throw 'Se inició una tarea durante la descarga. Vuelve a actualizar al terminar.' }
$jarvisPid=(Get-NetTCPConnection -LocalPort 4317 -State Listen | Select-Object -First 1).OwningProcess
$jarvisProcess=Get-CimInstance Win32_Process -Filter "ProcessId = $jarvisPid"
if ($jarvisProcess.CommandLine.Replace('/','\').IndexOf((Join-Path $jarvisRoot 'server.mjs').Replace('/','\'),[StringComparison]::OrdinalIgnoreCase) -lt 0) { throw 'El servidor activo pertenece a otra instalación.' }
$jarvisFiles=@(Get-ChildItem -LiteralPath $jarvisSource -Recurse -File | Where-Object { !$_.FullName.StartsWith((Join-Path $jarvisSource 'node_modules')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) })
$jarvisAdded=@();$jarvisStopped=$false;$jarvisModulesMoved=$false
try {
 foreach ($jarvisFile in $jarvisFiles) { $jarvisRelative=$jarvisFile.FullName.Substring($jarvisSource.Length+1);$jarvisDest=Join-Path $jarvisRoot $jarvisRelative;if(Test-Path -LiteralPath $jarvisDest){$jarvisOld=Join-Path $jarvisBackup $jarvisRelative;New-Item -ItemType Directory -Force (Split-Path $jarvisOld) | Out-Null;Copy-Item -LiteralPath $jarvisDest -Destination $jarvisOld}else{$jarvisAdded+=$jarvisDest} }
 Stop-Process -Id $jarvisPid;$jarvisStopped=$true
 Start-Sleep -Seconds 2
 $jarvisModules=Join-Path $jarvisRoot 'node_modules';$jarvisOldModules=Join-Path $jarvisBackup 'node_modules'
 if(Test-Path -LiteralPath $jarvisModules){Move-Item -LiteralPath $jarvisModules -Destination $jarvisOldModules;$jarvisModulesMoved=$true}
 foreach ($jarvisFile in $jarvisFiles) { $jarvisDest=Join-Path $jarvisRoot $jarvisFile.FullName.Substring($jarvisSource.Length+1);New-Item -ItemType Directory -Force (Split-Path $jarvisDest) | Out-Null;Copy-Item -LiteralPath $jarvisFile.FullName -Destination $jarvisDest -Force }
 Move-Item -LiteralPath (Join-Path $jarvisSource 'node_modules') -Destination $jarvisModules
 & (Join-Path $jarvisRoot 'Start-Jarvis.ps1') -Background
 Write-Output "JARVIS actualizado a $jarvisTarget. Copia anterior conservada en $jarvisBackup"
} catch {
 $jarvisFailure=$_
 if($jarvisStopped){
  $jarvisFailedPid=(Get-NetTCPConnection -LocalPort 4317 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
  if($jarvisFailedPid){$jarvisFailedProcess=Get-CimInstance Win32_Process -Filter "ProcessId = $jarvisFailedPid";if($jarvisFailedProcess.CommandLine.Contains((Join-Path $jarvisRoot 'server.mjs'))){Stop-Process -Id $jarvisFailedPid}}
  foreach($jarvisOldFile in @(Get-ChildItem -LiteralPath $jarvisBackup -Recurse -File | Where-Object { !$_.FullName.StartsWith((Join-Path $jarvisBackup 'node_modules')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) })){Copy-Item -LiteralPath $jarvisOldFile.FullName -Destination (Join-Path $jarvisRoot $jarvisOldFile.FullName.Substring($jarvisBackup.Length+1)) -Force}
  foreach($jarvisNewFile in $jarvisAdded){if(Test-Path -LiteralPath $jarvisNewFile){Remove-Item -LiteralPath $jarvisNewFile}}
  if($jarvisModulesMoved){if(Test-Path -LiteralPath $jarvisModules){Move-Item -LiteralPath $jarvisModules -Destination (Join-Path $jarvisStage 'failed-node_modules')};Move-Item -LiteralPath $jarvisOldModules -Destination $jarvisModules}
  & (Join-Path $jarvisRoot 'Start-Jarvis.ps1') -Background
 }
 throw $jarvisFailure
}
