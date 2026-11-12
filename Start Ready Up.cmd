@echo off
rem Double-click to run Ready Up from this folder. Installs and builds on the first run.
setlocal
title Ready Up
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Ready Up needs Node.js 22 or newer to run from source.
  echo   Install the LTS version from https://nodejs.org , then double-click this file again.
  echo.
  pause
  exit /b 1
)
node scripts\start.mjs %*
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)
