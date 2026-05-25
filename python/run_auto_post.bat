@echo off
REM ============================================================================
REM run_auto_post.bat
REM ----------------------------------------------------------------------------
REM Daily runner for The Kitchen Connection auto-post pipeline.
REM
REM What it does:
REM   1. Sets the current directory to this script's folder (python\)
REM   2. Activates a local virtualenv if one exists at .\venv\
REM   3. Installs / upgrades requirements.txt (idempotent, fast on subsequent runs)
REM   4. Runs auto_post.py in "run" mode (collect + post one to Instagram)
REM   5. Writes a timestamped log file to .\logs\
REM
REM Schedule it daily at 09:00 JST with setup_schedule.bat.
REM Manual run from PowerShell / cmd: just double-click this file or run it.
REM ============================================================================

setlocal ENABLEDELAYEDEXPANSION

REM ── Resolve paths relative to this batch file (works from any CWD) ───────────
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM ── Build a timestamp for the log file (YYYYMMDD-HHMMSS) ─────────────────────
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value ^| find "="') do set DT=%%I
set "TS=%DT:~0,8%-%DT:~8,6%"
if not exist "logs" mkdir "logs"
set "LOGFILE=logs\auto_post-%TS%.log"

echo [%TIME%] ===== auto_post run started ===== > "%LOGFILE%"
echo [%TIME%] Working dir: %CD%               >> "%LOGFILE%"

REM ── Pick the right Python interpreter ───────────────────────────────────────
REM Prefer a local venv (python\venv\Scripts\python.exe); fall back to system python.
set "PY=python"
if exist "venv\Scripts\python.exe" (
    set "PY=venv\Scripts\python.exe"
    echo [%TIME%] Using virtualenv: %CD%\venv >> "%LOGFILE%"
) else (
    echo [%TIME%] Using system python (no venv found at %CD%\venv) >> "%LOGFILE%"
)

REM ── Install / upgrade dependencies (quiet) ──────────────────────────────────
echo [%TIME%] Installing dependencies... >> "%LOGFILE%"
"%PY%" -m pip install --quiet --disable-pip-version-check -r requirements.txt >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    echo [%TIME%] WARNING: pip install returned an error — continuing anyway. >> "%LOGFILE%"
)

REM ── Run the pipeline ────────────────────────────────────────────────────────
echo [%TIME%] Running auto_post.py run ... >> "%LOGFILE%"
"%PY%" auto_post.py run --verbose >> "%LOGFILE%" 2>&1
set "EXITCODE=%ERRORLEVEL%"

echo [%TIME%] ===== auto_post finished with exit code %EXITCODE% ===== >> "%LOGFILE%"

REM Mirror exit code so Windows Task Scheduler shows success/failure correctly.
endlocal & exit /b %EXITCODE%
