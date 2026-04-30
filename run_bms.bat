@echo off
title Uganda National Roads Management Platform — DNR
echo.
echo  ================================================================
echo   Uganda National Roads Management Platform
echo   Dept. of National Roads ^| Ministry of Works ^& Transport
echo  ================================================================
echo.

cd /d "%~dp0"

:: Kill any previous Vite instances on ports 5173-5176
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 :5174 :5175 :5176" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo  Starting platform on http://localhost:5173 ...
echo  Chrome will open automatically.
echo  Press Ctrl+C to stop.
echo.

:: Start Vite dev server (forces port 5173)
start /B cmd /c "npm run dev -- --port 5173 > vite.log 2>&1"

:: Wait for Vite to be ready (polls for the port)
:WAIT
timeout /t 1 /nobreak >nul
netstat -aon | findstr ":5173 " >nul 2>&1
if errorlevel 1 goto WAIT

:: Open Chrome
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --new-window "http://localhost:5173"

:: Keep window open showing logs
echo  Platform running at http://localhost:5173
echo  Logs: vite.log
echo.
npm run dev -- --port 5173
pause
