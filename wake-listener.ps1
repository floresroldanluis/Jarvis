param([string]$ControlPath,[string]$WavePath,[int]$OwnerProcessId=0)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Speech
function Publish($event){[Console]::Out.WriteLine(($event|ConvertTo-Json -Compress));[Console]::Out.Flush()}
function Suspended {
  try{$control=Get-Content -LiteralPath $ControlPath -Raw|ConvertFrom-Json;return ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -lt $control.until)}catch{return $false}
}
$engine=$null
try {
  $info=[System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()|Where-Object {$_.Culture.TwoLetterISOLanguageName -eq 'es'}|Select-Object -First 1
  if(!$info){throw 'No hay reconocimiento de voz local en español instalado.'}
  $engine=New-Object System.Speech.Recognition.SpeechRecognitionEngine($info)
  $wakeBuilder=New-Object System.Speech.Recognition.GrammarBuilder
  $wakeBuilder.Culture=$info.Culture
  $wakeBuilder.Append('Jarvis')
  $wake=New-Object System.Speech.Recognition.Grammar($wakeBuilder)
  $wake.Name='wake'
  $requestBuilder=New-Object System.Speech.Recognition.GrammarBuilder
  $requestBuilder.Culture=$info.Culture
  $requestBuilder.Append('Jarvis')
  $requestBuilder.AppendDictation()
  $request=New-Object System.Speech.Recognition.Grammar($requestBuilder)
  $request.Name='request'
  $follow=New-Object System.Speech.Recognition.DictationGrammar
  $follow.Name='follow'
  $follow.Enabled=$false
  $engine.LoadGrammar($wake)
  $engine.LoadGrammar($request)
  $engine.LoadGrammar($follow)
  $engine.InitialSilenceTimeout=[TimeSpan]::FromSeconds(3)
  $engine.EndSilenceTimeout=[TimeSpan]::FromMilliseconds(1100)
  $engine.EndSilenceTimeoutAmbiguous=[TimeSpan]::FromMilliseconds(1500)
  if($WavePath){$engine.SetInputToWaveFile($WavePath)}else{$engine.SetInputToDefaultAudioDevice()}
  Publish @{type='ready';culture=$info.Culture.Name;source=$(if($WavePath){'wave'}else{'microphone'})}
  $armedUntil=[DateTime]::MinValue
  $audioPaused=$false
  while($true){
    if($OwnerProcessId -and !(Get-Process -Id $OwnerProcessId -ErrorAction SilentlyContinue)){break}
    if(!$WavePath -and (Suspended)){$armedUntil=[DateTime]::MinValue;if(!$audioPaused){$engine.SetInputToNull();$audioPaused=$true};Start-Sleep -Milliseconds 200;continue}
    if($audioPaused){$engine.SetInputToDefaultAudioDevice();$audioPaused=$false}
    if($armedUntil -ne [DateTime]::MinValue -and [DateTime]::UtcNow -ge $armedUntil){$armedUntil=[DateTime]::MinValue;Publish @{type='waiting'}}
    $armed=[DateTime]::UtcNow -lt $armedUntil
    $wake.Enabled=!$armed;$request.Enabled=!$armed;$follow.Enabled=$armed
    $result=$engine.Recognize([TimeSpan]::FromSeconds(4))
    if(!$WavePath -and (Suspended)){$armedUntil=[DateTime]::MinValue;continue}
    if($result){
      if($result.Grammar.Name -eq 'wake'){
        if($result.Confidence -ge .55){$armedUntil=[DateTime]::UtcNow.AddSeconds(15);Publish @{type='wake';confidence=$result.Confidence};if(!$WavePath){[System.Media.SystemSounds]::Asterisk.Play()}}
      }elseif($result.Grammar.Name -eq 'request'){
        Publish @{type='command';text=$result.Text;confidence=$result.Confidence;withWake=$true}
        $armedUntil=[DateTime]::MinValue
      }elseif($result.Grammar.Name -eq 'follow' -and $armed){
        Publish @{type='command';text=$result.Text;confidence=$result.Confidence;withWake=$false}
        $armedUntil=[DateTime]::MinValue
      }
    }
    if($WavePath){break}
  }
}catch{Publish @{type='error';message=$_.Exception.Message};exit 1}
finally{if($engine){$engine.Dispose()}}
