@echo off
cls
cd /d "%~dp0"

echo Starting AdOps Dashboard (Backend and Frontend)...
echo.

REM Start the backend server in background (no new window)
echo Starting Backend Server on http://localhost:5000...
start /b /d "backend" npm start

REM Wait for backend to fully initialize
timeout /t 3 /nobreak

echo.
echo Starting Frontend Server on http://localhost:5173...
echo.

REM Start the frontend dev server (will display in this window)
cd frontend
npm run dev