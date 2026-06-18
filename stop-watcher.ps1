# stop-watcher.ps1 — find and stop the watcher node process (matches watcher.mjs
# in the command line via CIM, since Get-Process does not expose CommandLine).
$procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*watcher.mjs*" }
if ($procs) {
  $procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host "Stopped watcher (PID $($_.ProcessId))." }
} else {
  Write-Host "No watcher process found."
}
