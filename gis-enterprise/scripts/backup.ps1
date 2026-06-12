# UGROADS geodatabase — nightly backup to the G: canonical repository.
# Schedule: Task Scheduler -> Daily 01:00 ->
#   powershell -ExecutionPolicy Bypass -File "...\gis-enterprise\scripts\backup.ps1"
# Keeps the last 14 dumps; Google Drive adds its own version history on top.

$ErrorActionPreference = 'Stop'
$root   = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$envMap = @{}
Get-Content (Join-Path $root '.env') | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object {
  $k, $v = $_ -split '=', 2; $envMap[$k.Trim()] = $v.Trim()
}
$env:PGPASSWORD = $envMap['PGPASSWORD']
$dir   = 'G:\My Drive\MOWT\Uganda National Road Network Repository\db_backups'
New-Item -ItemType Directory -Force $dir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd_HHmm'
$out   = Join-Path $dir "ugroads_$stamp.dump"

& pg_dump -h $envMap['PGHOST'] -p $envMap['PGPORT'] -U $envMap['PGUSER'] `
          -d $envMap['PGDATABASE'] -Fc -f $out
Write-Output "backup written: $out ($([math]::Round((Get-Item $out).Length/1MB,1)) MB)"

# retention: newest 14
Get-ChildItem $dir -Filter 'ugroads_*.dump' | Sort-Object LastWriteTime -Descending |
  Select-Object -Skip 14 | Remove-Item -Confirm:$false
