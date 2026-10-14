param([ValidateSet('closed','pending','not_running','denied')][string]$Scenario)
$ErrorActionPreference='Stop'
$global:jarvisMockScenario=$Scenario
$global:jarvisMockRequested=$false
function Get-StartApps { return @() }
function Get-AppxPackage { return @() }
function Get-ChildItem { return @() }
function Get-Process {
 param($Id,$Name,$ErrorAction)
 if($Id){return [pscustomobject]@{SessionId=1}}
 if($global:jarvisMockScenario -eq 'not_running' -or ($global:jarvisMockScenario -eq 'closed' -and $global:jarvisMockRequested)){return @()}
 $fixture=[pscustomobject]@{SessionId=1;MainWindowHandle=1;Path='C:\Windows\notepad.exe'}
 $fixture|Add-Member -MemberType ScriptMethod -Name CloseMainWindow -Value {$global:jarvisMockRequested=$true;return $global:jarvisMockScenario -ne 'denied'}
 return $fixture
}
function Start-Sleep { param($Milliseconds) }
& (Join-Path (Split-Path $PSScriptRoot) 'windows-apps.ps1')
