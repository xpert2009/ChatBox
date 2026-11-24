@echo off
setlocal
echo ========================================
echo    Dream Chat - Auto Setup Starting...
echo ========================================

echo.
echo [1/4] Installing Backend Dependencies...
cd /d "%~dp0server"
call npm install
if errorlevel 1 goto fail
echo Backend Dependencies Installed!

echo.
echo [2/4] Installing Frontend Dependencies...
cd /d "%~dp0client"
call npm install
if errorlevel 1 goto fail
echo Frontend Dependencies Installed!

echo.
echo [3/4] Checking for Errors...
cd /d "%~dp0server"
call npm run lint --if-present
cd /d "%~dp0client"
call npm run lint --if-present
echo Error Check Complete!

echo.
echo [4/4] Build Test...
call npm run build
if errorlevel 1 goto fail
echo Build Successful!

echo.
echo ========================================
echo  SETUP COMPLETE!
echo  Fill in client\.env and server\.env,
echo  then double-click start.bat.
echo ========================================
pause
exit /b 0

:fail
echo.
echo Setup stopped because a command failed.
pause
exit /b 1
