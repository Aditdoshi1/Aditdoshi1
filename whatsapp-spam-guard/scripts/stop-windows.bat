@echo off
setlocal
echo Stopping WhatsApp Spam Guard...
for /f "tokens=2" %%p in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| findstr /I "PID:"') do (
  wmic process where "ProcessId=%%p" get CommandLine 2>nul | findstr /I "src\\index.js" >nul
  if not errorlevel 1 (
    echo Stopping PID %%p
    taskkill /PID %%p /F >nul 2>&1
  )
)
echo Done. If the bot is still running, close the "WhatsApp Spam Guard" Command Prompt window.
endlocal
