@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Installing SecureFile Scanner Bridge dependencies...
  npm install
  if errorlevel 1 pause & exit /b 1
)
where NAPS2.Console.exe >nul 2>&1
if %errorlevel%==0 (
  echo NAPS2 detected on PATH.
) else if exist "C:\Program Files\NAPS2\NAPS2.Console.exe" (
  echo NAPS2 detected in Program Files.
) else if exist "C:\Program Files (x86)\NAPS2\NAPS2.Console.exe" (
  echo NAPS2 detected in Program Files x86.
) else (
  echo.
  echo WARNING: NAPS2 was not found.
  echo WIA scanners will still be attempted, but install NAPS2 for TWAIN/eSCL and broader compatibility.
  echo.
)
echo.
echo SecureFile Universal Scanner Bridge is starting on http://127.0.0.1:8765
echo Keep this window open while SecureFile is scanning.
npm start
pause
