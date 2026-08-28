@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Installing SecureFile Scanner Bridge dependencies...
  npm install
  if errorlevel 1 pause & exit /b 1
)
echo.
echo SecureFile Scanner Bridge is starting on http://127.0.0.1:8765
npm start
pause
