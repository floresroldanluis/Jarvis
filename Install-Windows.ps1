$ErrorActionPreference = 'Stop'
# Per-user install registration; retain the existing app and its private data.
$jarvisLauncher = Join-Path $PSScriptRoot 'Start-Jarvis.ps1'
if (!(Test-Path -LiteralPath $jarvisLauncher)) { throw 'No se encontró Start-Jarvis.ps1.' }
if (!(Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'Instala Node.js 22 o posterior antes de continuar.' }
if (!(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules/nodemailer'))) {
  Push-Location $PSScriptRoot
  try { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' } } finally { Pop-Location }
}
$jarvisCommand = 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $jarvisLauncher + '" -Background'
$jarvisRunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
New-Item -Path $jarvisRunKey -Force | Out-Null
$jarvisPrevious = $null
try { $jarvisPrevious = Get-ItemPropertyValue -Path $jarvisRunKey -Name 'JarvisOS' -ErrorAction Stop } catch [System.Management.Automation.PSArgumentException] {}
if ($jarvisPrevious -and $jarvisPrevious -ne $jarvisCommand) { throw 'Ya hay otra instalación de JarvisOS registrada. No se ha reemplazado.' }
New-ItemProperty -Path $jarvisRunKey -Name 'JarvisOS' -Value $jarvisCommand -PropertyType String -Force | Out-Null
$jarvisMenu = Join-Path ([Environment]::GetFolderPath('Programs')) 'JARVIS OS'
New-Item -ItemType Directory -Path $jarvisMenu -Force | Out-Null
$jarvisShell = New-Object -ComObject WScript.Shell
$jarvisShortcut = $jarvisShell.CreateShortcut((Join-Path $jarvisMenu 'JARVIS OS.lnk'))
$jarvisShortcut.TargetPath = 'powershell.exe'
$jarvisShortcut.Arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $jarvisLauncher + '"'
$jarvisShortcut.WorkingDirectory = $PSScriptRoot
$jarvisShortcut.WindowStyle = 7
$jarvisShortcut.Save()
& $jarvisLauncher -Background
Write-Output 'JARVIS registrado: inicio automático al iniciar tu sesión de Windows y acceso en Inicio > JARVIS OS. Conserva esta carpeta.'
