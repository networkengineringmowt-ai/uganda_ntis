# start-watcher.ps1 — launch the Uganda NRMS build-and-deploy watcher in the
# background and tail its log. Double-click or run from PowerShell.
$proj = "G:\My Drive\MOWT\Uganda National Road Network Repository\uganda-roads"
Set-Location $proj
Write-Host "Starting Uganda NRMS build watcher in $proj ..."
Start-Process -WindowStyle Hidden -FilePath "node" -ArgumentList "watcher.mjs" `
  -WorkingDirectory $proj `
  -RedirectStandardOutput "$proj\uganda-roads-watcher.log" `
  -RedirectStandardError  "$proj\uganda-roads-watcher-err.log"
Write-Host "Watcher running in background. Tailing log (Ctrl+C to stop tailing — watcher keeps running)..."
Start-Sleep -Seconds 1
Get-Content -Path "$proj\uganda-roads-watcher.log" -Wait
