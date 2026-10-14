$ErrorActionPreference = 'Stop'
$jarvisKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$jarvisValue = $null
try { $jarvisValue = Get-ItemPropertyValue -Path $jarvisKey -Name 'JarvisOS' -ErrorAction Stop } catch [System.Management.Automation.PSArgumentException] {}
if ($jarvisValue -and $jarvisValue.Contains($PSScriptRoot)) { Remove-ItemProperty -Path $jarvisKey -Name 'JarvisOS' }
$jarvisLink = Join-Path ([Environment]::GetFolderPath('Programs')) 'JARVIS OS\JARVIS OS.lnk'
if (Test-Path -LiteralPath $jarvisLink) {
  $jarvisShell = New-Object -ComObject WScript.Shell
  if ($jarvisShell.CreateShortcut($jarvisLink).Arguments.Contains($PSScriptRoot)) { Remove-Item -LiteralPath $jarvisLink }
}
Write-Output 'Inicio automático desactivado. Los documentos y ajustes se conservan.'
