param(
  [string]$OutputJson,
  [int]$Pages=1,
  [int]$ResolutionDpi=300,
  [string]$ColorMode='COLOR',
  [string]$Duplex='False',
  [string]$Source='ADF',
  [string]$DeviceId='',
  [switch]$ListDevices
)
$ErrorActionPreference='Stop'
$manager = New-Object -ComObject WIA.DeviceManager
if($ListDevices){
  $devices=@()
  foreach($info in $manager.DeviceInfos){
    if($info.Type -eq 1){
      $name='';$manufacturer=''
      try{$name=[string]$info.Properties.Item('Name').Value}catch{}
      try{$manufacturer=[string]$info.Properties.Item('Manufacturer').Value}catch{}
      $devices += [pscustomobject]@{id=[string]$info.DeviceID;name=$name;manufacturer=$manufacturer}
    }
  }
  [pscustomobject]@{devices=$devices}|ConvertTo-Json -Depth 5 -Compress
  exit 0
}
if(-not $OutputJson){throw 'OutputJson is required.'}
$dir=Split-Path $OutputJson -Parent
$sourceUpper=$Source.ToUpperInvariant();if($sourceUpper -notin @('ADF','FLATBED')){$sourceUpper='ADF'}
$maxPages=if($sourceUpper -eq 'FLATBED'){1}else{100};$Pages=[Math]::Max(1,[Math]::Min($maxPages,$Pages));$ResolutionDpi=[Math]::Max(75,[Math]::Min(1200,$ResolutionDpi))
$deviceInfo=$null
foreach($info in $manager.DeviceInfos){if($info.Type -eq 1 -and ((-not $DeviceId) -or [string]$info.DeviceID -eq $DeviceId)){$deviceInfo=$info;break}}
if(-not $deviceInfo){throw 'No selected WIA scanner was found. Refresh scanners and select a device, then confirm its Windows driver is installed.'}
$device=$deviceInfo.Connect();if($device.Items.Count -lt 1){throw 'The selected WIA scanner did not expose a scan item.'};$item=$device.Items.Item(1)
function SetProp($id,$value){try{$item.Properties.Item($id).Value=$value;return $true}catch{return $false}}
SetProp 4106 '{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}'|Out-Null
SetProp 6147 $ResolutionDpi|Out-Null;SetProp 6148 $ResolutionDpi|Out-Null
$cm=if($ColorMode -eq 'GRAY'){2}elseif($ColorMode -eq 'BW'){4}else{1};SetProp 6146 $cm|Out-Null
if($sourceUpper -eq 'FLATBED'){SetProp 3088 2|Out-Null;$Pages=1}else{$handling=1;if($Duplex -eq 'True'){$handling=5};SetProp 3088 $handling|Out-Null;SetProp 3096 $Pages|Out-Null}
$files=@()
for($i=1;$i -le $Pages;$i++){
  try{
    $image=$item.Transfer();if(-not $image){throw 'The scanner returned no image.'}
    $file=Join-Path $dir ("page-{0:000}.jpg" -f $i)
    $jpegGuid='{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}'
    if([string]$image.FormatID -ne $jpegGuid){$processor=New-Object -ComObject WIA.ImageProcess;$processor.Filters.Add($processor.FilterInfos.Item('Convert').FilterID)|Out-Null;$processor.Filters.Item(1).Properties.Item('FormatID').Value=$jpegGuid;$image=$processor.Apply($image)}
    $image.SaveFile($file);$files+=$file;if($sourceUpper -eq 'FLATBED'){break}
  }catch{if($files.Count -eq 0){throw};break}
}
if($files.Count -eq 0){throw 'No page was scanned. Place a document in the feeder/flatbed and try again.'}
[pscustomobject]@{files=$files}|ConvertTo-Json -Compress|Set-Content -Encoding UTF8 $OutputJson
