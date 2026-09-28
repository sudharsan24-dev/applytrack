@echo off
setlocal
cd /d "%~dp0"
set "APP_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "APP_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%APP_NODE%" --version >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 LTS first, then follow README.md.
  pause
  exit /b 1
)
if not exist node_modules\vite\bin\vite.js (
  echo First run pnpm install --frozen-lockfile in this folder.
  pause
  exit /b 1
)
"%APP_NODE%" node_modules\vite\bin\vite.js build --configLoader native
if errorlevel 1 (
  pause
  exit /b 1
)
set "DB_DRIVER=sqlite"
set "PORT=3001"
set "HOST=127.0.0.1"
set "APP_ORIGIN=http://localhost:3001"
set "NODE_ENV=development"
echo Open http://localhost:3001 and choose Explore the demo.
echo Keep this window open while using ApplyTrack. Press Ctrl+C to stop.
"%APP_NODE%" server\index.js
pause
