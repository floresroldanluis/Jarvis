param([string]$Action, [string]$Path)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Security
if ($Action -eq 'save') {
  $jarvisPlain = [Console]::In.ReadToEnd()
  $jarvisBytes = [System.Text.Encoding]::UTF8.GetBytes($jarvisPlain)
  $jarvisEncrypted = [System.Security.Cryptography.ProtectedData]::Protect($jarvisBytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
  [System.IO.File]::WriteAllBytes($Path, $jarvisEncrypted)
  [Console]::Out.Write('saved')
} elseif ($Action -eq 'read') {
  $jarvisEncrypted = [System.IO.File]::ReadAllBytes($Path)
  $jarvisBytes = [System.Security.Cryptography.ProtectedData]::Unprotect($jarvisEncrypted, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
  [Console]::Out.Write([System.Text.Encoding]::UTF8.GetString($jarvisBytes))
}
