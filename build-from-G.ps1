# build-from-G.ps1 — build this Google-Drive-hosted repo on local disk.
# Google Drive can't host node_modules (no junctions; npm install never finishes),
# so we copy the source to a local dir, install there, and build.
$ErrorActionPreference = "Stop"
$SRC   = $PSScriptRoot
$LOCAL = "C:\tmp\uganda-build"
Write-Host "Copying source -> $LOCAL (excluding node_modules/.git/dist/*.db)..."
New-Item -ItemType Directory -Force -Path $LOCAL | Out-Null
robocopy $SRC $LOCAL /E /XD node_modules .git dist "*_nm_partial*" /XF *.db /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null
Push-Location $LOCAL
if (-not (Test-Path "$LOCAL\node_modules\.bin\vite.cmd")) {
  Write-Host "Installing dependencies on local disk (one-time)..."
  npm install   # npm install (not ci) so a lockfile drift never blocks the build
}
Write-Host "Type-checking + building..."
npx tsc -b
npx vite build --outDir "$LOCAL\dist"
Pop-Location
Write-Host "`nBuild output: $LOCAL\dist"
Write-Host "To deploy: overlay onto your gh-pages worktree (C:\tmp\ghdep) and force-push."
