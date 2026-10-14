param([string]$Action, [string]$InputPath, [string]$OutputPath)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech
if ($Action -eq 'status') {
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $voices = @($synth.GetInstalledVoices() | ForEach-Object { @{name=$_.VoiceInfo.Name; culture=$_.VoiceInfo.Culture.Name} })
  $recognizers = @([System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() | ForEach-Object { @{id=$_.Id; culture=$_.Culture.Name} })
  @{voices=$voices; recognizers=$recognizers} | ConvertTo-Json -Depth 4 -Compress
  $synth.Dispose()
} elseif ($Action -eq 'speak' -or $Action -eq 'say') {
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq 'es' } | Select-Object -First 1
  if ($voice) { $synth.SelectVoice($voice.VoiceInfo.Name) }
  if ($Action -eq 'say') {$synth.SetOutputToDefaultAudioDevice()} else {$synth.SetOutputToWaveFile($OutputPath)}
  $synth.Speak([System.IO.File]::ReadAllText($InputPath, [System.Text.Encoding]::UTF8))
  $synth.Dispose()
} elseif ($Action -eq 'listen') {
  $info = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() | Where-Object { $_.Culture.TwoLetterISOLanguageName -eq 'es' } | Select-Object -First 1
  if (!$info) { throw 'No hay un reconocedor local en español instalado en Windows.' }
  $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine($info)
  try {
    $engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
    $engine.SetInputToWaveFile($InputPath)
    $result = $engine.Recognize([TimeSpan]::FromSeconds(30))
    if (!$result) { throw 'No pude reconocer la grabación. Habla más cerca del micrófono e inténtalo otra vez.' }
    @{text=$result.Text; confidence=$result.Confidence} | ConvertTo-Json -Compress
  } finally { $engine.Dispose() }
}
