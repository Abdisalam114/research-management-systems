@echo off
cd /d "%~dp0"
echo.
echo Starting RMS. Browser: http://localhost:5173
echo Login: director@rms.edu / Director2024!
echo Stop with Ctrl+C
echo.
call npm run dev
