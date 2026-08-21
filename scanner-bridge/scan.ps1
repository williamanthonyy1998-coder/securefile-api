param(
  [string]$OutputJson,
  [int]$Pages=1,
  [int]$ResolutionDpi=300,
  [string]$ColorMode='COLOR',
  [string]$Duplex='False',
  [string]$Source='ADF'
)
$ErrorActionPreference='Stop'
$dir=Split-Path $OutputJson -Parent
$manager=New-Object -ComObject WIA.DeviceManager
$deviceInfo=$null
foreach($info in $manager.DeviceInfos){ if($info.Type -eq 1){ $deviceInfo=$info; break } }
if(-not $deviceInfo){ throw 'No WIA scanner was found. Install the scanner driver and make sure Windows can see the scanner.' }
$device=$deviceInfo.Connect()
$item=$device.Items.Item(1)
function SetProp($id,$value){ try{$item.Properties.Item($id).Value=$value}catch{} }
SetProp 6147 $ResolutionDpi
SetProp 6148 $ResolutionDpi
$cm=if($ColorMode -eq 'GRAY'){2}elseif($ColorMode -eq 'BW'){4}else{1}
SetProp 6146 $cm
$sourceUpper=$Source.ToUpperInvariant()
if($sourceUpper -eq 'FLATBED'){
  SetProp 3088 2
  $Pages=1
}else{
  # ADF=1, DUPLEX=4. Combine them when both sides are requested.
  $handling=1
  if($Duplex -eq 'True'){ $handling=5 }
  SetProp 3088 $handling
}
$files=@()
for($i=1;$i -le [Math]::Max(1,$Pages);$i++){
  try{
    $image=$item.Transfer()
    $file=Join-Path $dir ("page-{0:000}.jpg" -f $i)
    $image.SaveFile($file)
    $files += $file
    if($sourceUpper -eq 'FLATBED'){ break }
  }catch{
    if($files.Count -eq 0){ throw }
    break
  }
}
[pscustomobject]@{files=$files}|ConvertTo-Json -Compress|Set-Content -Encoding UTF8 $OutputJson
