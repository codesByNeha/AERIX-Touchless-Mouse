@echo off
setlocal
set "PROJECT_ROOT=%~dp0Mouse_updated (1)\Mouse_extracted"

pushd "%PROJECT_ROOT%" || exit /b 1
echo Starting Touchless Mouse FastAPI server...
start "Touchless Mouse API" /b python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

echo Waiting for FastAPI...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline=(Get-Date).AddSeconds(60); do { try { $response=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8000/' -TimeoutSec 3; if ($response.StatusCode -eq 200) { exit 0 } } catch {} Start-Sleep -Milliseconds 500 } while ((Get-Date) -lt $deadline); exit 1"
if errorlevel 1 (
  echo FastAPI did not become ready within one minute.
  popd
  exit /b 1
)

start "" "http://127.0.0.1:8000/"
echo Touchless Mouse is ready at http://127.0.0.1:8000/
popd
endlocal
