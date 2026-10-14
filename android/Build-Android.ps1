param([string]$SdkRoot=$env:ANDROID_HOME)
$ErrorActionPreference='Stop'
if (!$SdkRoot) { throw 'Define ANDROID_HOME con tu Android SDK.' }
$jarvisAndroid=$PSScriptRoot
$jarvisApp=Split-Path $jarvisAndroid
$jarvisBuild=Join-Path $jarvisApp 'data/android-build'
$jarvisTools=Join-Path $SdkRoot 'build-tools/36.0.0'
$jarvisAndroidJar=Join-Path $SdkRoot 'platforms/android-35/android.jar'
$jarvisJavaBin=Join-Path $env:JAVA_HOME 'bin'
New-Item -ItemType Directory -Force $jarvisBuild,(Join-Path $jarvisBuild 'classes'),(Join-Path $jarvisBuild 'dex') | Out-Null
function Invoke-JarvisTool { param([string]$Tool,[string[]]$ToolArgs) & $Tool @ToolArgs; if ($LASTEXITCODE -ne 0) { throw "Falló la herramienta $Tool ($LASTEXITCODE)" } }
Invoke-JarvisTool (Join-Path $jarvisTools 'aapt2.exe') @('compile','--dir',(Join-Path $jarvisAndroid 'res'),'-o',(Join-Path $jarvisBuild 'resources.zip'))
Invoke-JarvisTool (Join-Path $jarvisTools 'aapt2.exe') @('link','-o',(Join-Path $jarvisBuild 'unsigned.apk'),'--manifest',(Join-Path $jarvisAndroid 'AndroidManifest.xml'),'-I',$jarvisAndroidJar,(Join-Path $jarvisBuild 'resources.zip'))
$jarvisSources=@(Get-ChildItem -LiteralPath (Join-Path $jarvisAndroid 'src') -Recurse -Filter '*.java' | ForEach-Object FullName)
Invoke-JarvisTool (Join-Path $jarvisJavaBin 'javac.exe') (@('-encoding','UTF-8','-source','8','-target','8','-classpath',$jarvisAndroidJar,'-d',(Join-Path $jarvisBuild 'classes'))+$jarvisSources)
Push-Location (Join-Path $jarvisBuild 'classes')
try { Invoke-JarvisTool (Join-Path $jarvisJavaBin 'jar.exe') @('cf',(Join-Path $jarvisBuild 'classes.jar'),'.') } finally { Pop-Location }
Invoke-JarvisTool (Join-Path $jarvisTools 'd8.bat') @('--min-api','26','--lib',$jarvisAndroidJar,'--output',(Join-Path $jarvisBuild 'dex'),(Join-Path $jarvisBuild 'classes.jar'))
Push-Location (Join-Path $jarvisBuild 'dex')
try { Invoke-JarvisTool (Join-Path $jarvisJavaBin 'jar.exe') @('uf',(Join-Path $jarvisBuild 'unsigned.apk'),'classes.dex') } finally { Pop-Location }
Invoke-JarvisTool (Join-Path $jarvisTools 'zipalign.exe') @('-f','4',(Join-Path $jarvisBuild 'unsigned.apk'),(Join-Path $jarvisBuild 'aligned.apk'))
$jarvisKey=Join-Path $jarvisApp 'data/android-development.jks'
# Local development signing identity. Keep this private key to update the installed APK.
if (!(Test-Path -LiteralPath $jarvisKey)) { Invoke-JarvisTool (Join-Path $jarvisJavaBin 'keytool.exe') @('-genkeypair','-keystore',$jarvisKey,'-storepass','android','-keypass','android','-alias','jarvis','-dname','CN=JARVIS Local Development','-keyalg','RSA','-keysize','3072','-validity','10000') }
$jarvisApk=Join-Path $jarvisApp 'data/JARVIS-Android.apk'
Invoke-JarvisTool (Join-Path $jarvisTools 'apksigner.bat') @('sign','--ks',$jarvisKey,'--ks-key-alias','jarvis','--ks-pass','pass:android','--key-pass','pass:android','--out',$jarvisApk,(Join-Path $jarvisBuild 'aligned.apk'))
Invoke-JarvisTool (Join-Path $jarvisTools 'apksigner.bat') @('verify','--verbose',$jarvisApk)
Write-Output $jarvisApk
