@echo off
setlocal
cd /d "%~dp0"
echo ================================================
echo SecureFile Universal Scanner Diagnostics
echo ================================================
echo.
where NAPS2.Console.exe >nul 2>&1
if %errorlevel%==0 (
  echo [OK] NAPS2.Console.exe is available on PATH.
) else if exist "C:\Program Files\NAPS2\NAPS2.Console.exe" (
  echo [OK] NAPS2 found in C:\Program Files\NAPS2
) else if exist "C:\Program Files (x86)\NAPS2\NAPS2.Console.exe" (
  echo [OK] NAPS2 found in C:\Program Files (x86)\NAPS2
) else (
  echo [WARN] NAPS2 was not found. WIA scanners can still use the direct fallback.
  echo        Install NAPS2 for TWAIN and eSCL/network scanner support.
)
echo.
echo Starting bridge temporarily so browser/device discovery can be tested...
node server.mjs
pause
