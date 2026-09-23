<#
Starts the dashboard in a dedicated Microsoft Edge app window and owns the
Docker lifecycle for that one window. A separate Edge user-data directory lets
us identify the app's processes without touching the user's normal browser.
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = "Stop"
$dashboardUrl = "http://localhost:8080"
$profileDirectory = Join-Path $env:LOCALAPPDATA "TouchlessMouseDashboard"

function Get-DashboardProcesses {
    # Query command lines rather than browser names alone. This is what keeps
    # the watchdog isolated from unrelated Edge/Chrome windows.
    Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" |
        Where-Object { $_.CommandLine -and $_.CommandLine.Contains($profileDirectory) }
}

function Find-Edge {
    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
        (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe")
    )
    $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

$edge = Find-Edge
if (-not $edge) {
    Write-Error "Microsoft Edge was not found. The dedicated dashboard window was not started."
    exit 1
}

New-Item -ItemType Directory -Force -Path $profileDirectory | Out-Null

if (Get-DashboardProcesses) {
    Write-Output "Touchless Mouse dashboard is already open."
    exit 0
}

Write-Output "Opening Touchless Mouse dashboard..."
Start-Process -FilePath $edge -ArgumentList @(
    "--app=$dashboardUrl",
    "--user-data-dir=$profileDirectory",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-mode"
) | Out-Null

# Edge may need a moment to create the app/browser process. Once it has been
# observed, wait until every process using this private profile is gone.
$seenDashboard = $false
$launchDeadline = (Get-Date).AddSeconds(30)
while ($true) {
    Start-Sleep -Seconds 1
    $dashboardProcesses = @(Get-DashboardProcesses)
    if ($dashboardProcesses.Count -gt 0) {
        $seenDashboard = $true
        continue
    }
    if ($seenDashboard) {
        break
    }
    if ((Get-Date) -ge $launchDeadline) {
        Write-Error "The dedicated dashboard window did not start within 30 seconds."
        break
    }
}

Write-Output "Dedicated dashboard window closed. Stopping Touchless Mouse containers..."
Push-Location $ProjectRoot
try {
    # Compose scopes this down operation to this project's services/network;
    # it does not stop unrelated Docker containers or images.
    & docker compose down
} finally {
    Pop-Location
}
