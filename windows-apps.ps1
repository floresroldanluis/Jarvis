$ErrorActionPreference='Stop'
[Console]::InputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
function Get-JarvisApps {
 $items=@()
 $items+=[pscustomobject]@{id='calculator';name='Calculadora';aliases=@('calculator');kind='exe';target='calc.exe';processNames=@('CalculatorApp','Calculator')}
 $items+=[pscustomobject]@{id='notepad';name='Bloc de notas';aliases=@('notepad');kind='exe';target='notepad.exe';processNames=@('Notepad')}
 $shortcutMap=@{}
 $shell=New-Object -ComObject WScript.Shell
 foreach($folder in @([Environment]::GetFolderPath('Programs'),[Environment]::GetFolderPath('CommonPrograms'))){
  foreach($file in @(Get-ChildItem -LiteralPath $folder -Filter '*.lnk' -Recurse -File -ErrorAction SilentlyContinue)){
   try{$shortcut=$shell.CreateShortcut($file.FullName);$target=$shortcut.TargetPath;if($target -and [IO.Path]::GetExtension($target) -ieq '.exe'){$shortcutMap[$file.BaseName]=$target}}catch{}
  }
 }
 $packages=@(Get-AppxPackage)
 foreach($app in @(Get-StartApps)){
  if($app.Name -match '^(Calculator|Calculadora|Notepad|Bloc de notas)$'){continue}
  $names=@();$paths=@();if($shortcutMap.ContainsKey($app.Name)){$paths+=@($shortcutMap[$app.Name]);$names+=@([IO.Path]::GetFileNameWithoutExtension($shortcutMap[$app.Name]))}
  if($app.AppID -match '^([^!]+)!(.+)$'){
   try{$family=$Matches[1];$applicationId=$Matches[2];$package=$packages | Where-Object PackageFamilyName -eq $family | Select-Object -First 1;if($package){$manifest=Get-AppxPackageManifest -Package $package;$application=$manifest.Package.Applications.Application | Where-Object Id -eq $applicationId | Select-Object -First 1;if($application.Executable){$names+=@([IO.Path]::GetFileNameWithoutExtension($application.Executable));$paths+=@(Join-Path $package.InstallLocation $application.Executable)}}}catch{}
  }
  $items+=[pscustomobject]@{id=$app.AppID;name=$app.Name;aliases=@();kind='startapp';target=$app.AppID;processNames=@($names|Where-Object {$_ -notin @('Update','powershell','pwsh','cmd','explorer','msiexec')}|Select-Object -Unique);paths=@($paths)}
 }
 return $items
}
try{
 $request=[Console]::In.ReadToEnd()|ConvertFrom-Json
 if($request.operation -notin @('list','open','close')){throw 'Operación no disponible.'}
 $catalog=@(Get-JarvisApps)
 if($request.operation -eq 'list'){$result=@{apps=@($catalog|Select-Object id,name,aliases)}}else{
  $app=$catalog|Where-Object id -CEQ $request.id|Select-Object -First 1
  if(!$app){throw 'La aplicación no está en el catálogo local.'}
  if($request.operation -eq 'open'){
   if($app.kind -eq 'exe'){Start-Process -FilePath $app.target -WindowStyle Normal|Out-Null}else{Start-Process -FilePath explorer.exe -ArgumentList ('"shell:AppsFolder\'+$app.target+'"') -WindowStyle Normal|Out-Null}
   $result=@{status='opened'}
  }else{
   if(!$app.processNames.Count){$result=@{status='unavailable'}}else{
    $session=(Get-Process -Id $PID).SessionId
    $windows=@(Get-Process -Name $app.processNames -ErrorAction SilentlyContinue|Where-Object {$_.SessionId -eq $session -and $_.MainWindowHandle -ne 0 -and (!$app.paths.Count -or $app.paths -icontains $_.Path)})
    if(!$windows.Count){$result=@{status='not_running'}}else{
     $requested=$false;foreach($window in $windows){try{if($window.CloseMainWindow()){$requested=$true}}catch{}}
     Start-Sleep -Milliseconds 1500
     $remaining=@(Get-Process -Name $app.processNames -ErrorAction SilentlyContinue|Where-Object {$_.SessionId -eq $session -and $_.MainWindowHandle -ne 0 -and (!$app.paths.Count -or $app.paths -icontains $_.Path)})
     $result=@{status=$(if(!$remaining.Count){'closed'}elseif($requested){'pending'}else{'denied'})}
    }
   }
  }
 }
 $result|ConvertTo-Json -Depth 6 -Compress
}catch{@{error=$_.Exception.Message}|ConvertTo-Json -Compress}
