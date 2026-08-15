@echo off
cd /d "%~dp0"
echo.
echo First-time setup — VS Code CMD is OK.
echo.
call npm run setup
if errorlevel 1 (
  echo.
  echo Setup failed. Install Node.js 18+ and start MongoDB, then run setup.bat again.
  pause
  exit /b 1
)
echo.
echo Next: run start.bat   or   npm run dev
pause
