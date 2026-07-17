$ErrorActionPreference = "Stop"
$env:NODE_ENV="production"
Write-Output "Building..."
npx vite build --config vite.ntis.config.ts

Write-Output "Preparing dist-ntis..."
if (Test-Path "dist-ntis/index.ntis.html") { Move-Item -Force "dist-ntis/index.ntis.html" "dist-ntis/index.html" }

Set-Location "dist-ntis"
if (Test-Path ".git") { Remove-Item -Recurse -Force .git }
git init -q
git checkout -q -b gh-pages
git -c user.name="UNRA GIS Team" -c user.email="gis@unra.go.ug" add -A
git -c user.name="UNRA GIS Team" -c user.email="gis@unra.go.ug" commit -q -m "Deploying code"
git push --force "https://github.com/networkengineringmowt-ai/uganda_ntis.git" gh-pages

Set-Location ..
$Dest = "G:\My Drive\MOWT\Uganda National Road Network Repository\builds\uganda_ntis"
if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
New-Item -ItemType Directory -Force $Dest | Out-Null
Copy-Item -Recurse "dist-ntis\*" $Dest
Write-Output "Deployment finished"
