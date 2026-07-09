@echo off
setlocal
cd /d "%~dp0.."
set DASHBOARD_PORT=3000
if exist config.yaml (
  for /f "tokens=2 delims=: " %%p in ('findstr /r /c:"^  port:" config.yaml') do set DASHBOARD_PORT=%%p
)

echo Starting WhatsApp Spam Guard in a new window...
echo Keep that window open for the bot to stay running.
start "WhatsApp Spam Guard" cmd /k "cd /d "%CD%" && npm start"

echo Waiting for dashboard on port %DASHBOARD_PORT%...
node scripts\wait-for-dashboard.js
if errorlevel 1 (
  echo.
  echo Dashboard did not start in time.
  echo Check the "WhatsApp Spam Guard" window for errors.
  echo Then run: npm run diagnose
  exit /b 1
)

echo.
echo Dashboard is ready. Opening browser...
set OPEN_DASHBOARD=1
node scripts\open-dashboard.js
if errorlevel 1 (
  echo Open manually: http://127.0.0.1:%DASHBOARD_PORT%
)
endlocal
