@echo off
REM ============================================================================
REM setup_schedule.bat
REM ----------------------------------------------------------------------------
REM Registers run_auto_post.bat as a Windows Scheduled Task that fires every
REM day at 09:00 Japan Standard Time (the machine's local time zone).
REM
REM Run ONCE, from an elevated (Administrator) cmd or PowerShell:
REM     setup_schedule.bat
REM
REM What it creates:
REM   Task name : KitchenConnection_AutoPost
REM   Trigger   : daily @ 09:00 local time
REM   Action    : C:\path\to\python\run_auto_post.bat
REM   User      : current user, runs whether logged on or not (/RU SYSTEM)
REM
REM To remove the task later:
REM     schtasks /delete /tn KitchenConnection_AutoPost /f
REM
REM To trigger it on demand for testing:
REM     schtasks /run /tn KitchenConnection_AutoPost
REM
REM To inspect status:
REM     schtasks /query /tn KitchenConnection_AutoPost /v /fo list
REM ============================================================================

setlocal

set "TASK_NAME=KitchenConnection_AutoPost"
set "SCRIPT_DIR=%~dp0"
set "RUNNER=%SCRIPT_DIR%run_auto_post.bat"

if not exist "%RUNNER%" (
    echo ERROR: cannot find %RUNNER%
    echo Make sure setup_schedule.bat and run_auto_post.bat are in the same folder.
    exit /b 1
)

echo Registering Windows scheduled task: %TASK_NAME%
echo   Runs : %RUNNER%
echo   When : every day at 09:00 (machine local time — set Tokyo / JST in Windows)
echo.

REM /F overwrites any existing task of the same name so re-running this script
REM is safe (e.g. after moving the project folder).
REM /RL HIGHEST gives the task the same privileges as an elevated shell — needed
REM if the pipeline ever has to touch a protected path.  Remove it if you'd
REM rather run as a standard user.
schtasks /Create ^
    /TN "%TASK_NAME%" ^
    /TR "\"%RUNNER%\"" ^
    /SC DAILY ^
    /ST 09:00 ^
    /RL HIGHEST ^
    /F

if errorlevel 1 (
    echo.
    echo FAILED to register the scheduled task.
    echo Try re-running this file from an elevated ^(Administrator^) cmd window.
    exit /b 1
)

echo.
echo SUCCESS — task '%TASK_NAME%' will run %RUNNER% every day at 09:00.
echo.
echo Reminder: this uses the Windows machine's local time zone.  If the
echo machine's time zone is "Tokyo Standard Time (UTC+9)", 09:00 here equals
echo 09:00 JST.  Confirm with:  systeminfo ^| findstr /B /C:"Time Zone"
echo.

endlocal
exit /b 0
