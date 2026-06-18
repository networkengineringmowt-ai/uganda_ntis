# watcher-status.ps1 — is the watcher running? + last 20 log lines.
$proj = "G:\My Drive\MOWT\Uganda National Road Network Repository\uganda-roads"
$proc = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*watcher.mjs*" } | Select-Object -First 1
if ($proc) { Write-Host "RUNNING (PID $($proc.ProcessId))" -ForegroundColor Green }
else       { Write-Host "NOT RUNNING" -ForegroundColor Yellow }
Write-Host "--- Last 20 log lines ---"
$log = "$proj\uganda-roads-watcher.log"
if (Test-Path $log) { Get-Content $log -Tail 20 } else { Write-Host "(no log yet)" }
