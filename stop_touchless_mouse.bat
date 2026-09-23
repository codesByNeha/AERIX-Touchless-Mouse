@echo off
setlocal
set "PROJECT_ROOT=%~dp0"

pushd "%PROJECT_ROOT%" || exit /b 1
echo Stopping Touchless Mouse...
docker compose down
if errorlevel 1 (
  echo Docker Compose could not stop Touchless Mouse.
  popd
  exit /b 1
)

for /f %%C in ('docker compose ps --status running -q') do set "RUNNING_CONTAINER=%%C"
if defined RUNNING_CONTAINER (
  echo Some Touchless Mouse containers are still running.
  popd
  exit /b 1
)

echo Touchless Mouse containers stopped cleanly.
popd
endlocal
