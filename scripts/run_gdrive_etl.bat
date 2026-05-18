@echo off
cd /d "%~dp0"
echo Installing gdown if needed...
pip install gdown openpyxl pandas -q
echo.
echo Step 1: Fetch and parse Google Drive files...
python fetch_and_parse.py
echo.
echo Step 2: Load JSON files into SQLite...
python load_from_gdrive.py
pause
