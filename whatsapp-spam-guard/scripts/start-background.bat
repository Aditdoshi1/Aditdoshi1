@echo off
setlocal
cd /d "%~dp0.."
echo Starting WhatsApp Spam Guard in a new window...
echo Keep that window open for the bot to stay running.
start "WhatsApp Spam Guard" cmd /k "cd /d \"%CD%\" && npm start"
timeout /t 4 /nobreak >nul
echo.
echo Dashboard: http://127.0.0.1:3000
echo If it does not load, run: npm run diagnose
endlocal
