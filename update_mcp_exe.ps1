# update_mcp_exe.ps1 - Build and install the latest codebase-memory-mcp.exe on Windows
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\update_mcp_exe.ps1
#   or: .\update_mcp_exe.sh1

[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [switch]$StartDaemon
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  codebase-memory-mcp: Build & Update Windows Binary" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$RepoRoot = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$BuiltExe = Join-Path $RepoRoot "build\win64\codebase-memory-mcp.exe"
$InstallDir = Join-Path $env:LOCALAPPDATA "Programs\codebase-memory-mcp"
$TargetExe = Join-Path $InstallDir "codebase-memory-mcp.exe"

# Step 1: Build the binary inside WSL using MinGW if not skipped
if (-not $SkipBuild) {
    Write-Host "[1/4] Building Windows native binary via WSL (MinGW 64-bit)..." -ForegroundColor Yellow
    Push-Location $RepoRoot
    try {
        & wsl.exe make -j8 -f Makefile.cbm BUILD_DIR=build/win64 CC=x86_64-w64-mingw32-gcc CXX=x86_64-w64-mingw32-g++ CFLAGS_EXTRA="-I/usr/x86_64-w64-mingw32/include" cbm-with-ui
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Build failed inside WSL with exit code $LASTEXITCODE."
            exit $LASTEXITCODE
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[1/4] Skipping build step (using existing binary at $BuiltExe)..." -ForegroundColor DarkGray
}

if (-not (Test-Path $BuiltExe)) {
    Write-Error "Built binary not found at $BuiltExe. Please ensure compilation succeeded."
    exit 1
}

$builtItem = Get-Item $BuiltExe
Write-Host "      Built binary: $BuiltExe ($([math]::Round($builtItem.Length / 1MB, 2)) MB, updated $($builtItem.LastWriteTime))" -ForegroundColor Green

# Step 2: Stop any running instances of codebase-memory-mcp.exe so the file is not locked
Write-Host ""
Write-Host "[2/4] Checking for running codebase-memory-mcp processes..." -ForegroundColor Yellow
$running = Get-Process -Name "codebase-memory-mcp" -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "      Found $($running.Count) running process(es). Stopping them to release file lock..." -ForegroundColor Cyan
    $running | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
} else {
    Write-Host "      No conflicting processes found." -ForegroundColor DarkGray
}

# Step 3: Backup existing executable and install the new binary
Write-Host ""
Write-Host "[3/4] Installing updated binary to $InstallDir..." -ForegroundColor Yellow
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

if (Test-Path $TargetExe) {
    $bakFile = "$TargetExe.bak"
    Write-Host "      Backing up current executable to $bakFile..." -ForegroundColor DarkGray
    Copy-Item -Path $TargetExe -Destination $bakFile -Force
}

Copy-Item -Path $BuiltExe -Destination $TargetExe -Force
$targetItem = Get-Item $TargetExe
Write-Host "      Successfully installed: $TargetExe ($([math]::Round($targetItem.Length / 1MB, 2)) MB)" -ForegroundColor Green

# Step 4: Verify the newly installed binary
Write-Host ""
Write-Host "[4/4] Verifying binary execution..." -ForegroundColor Yellow
try {
    $versionOut = & $TargetExe --version
    Write-Host "      Verified: $versionOut" -ForegroundColor Green
} catch {
    Write-Warning "      Execution check returned: $_"
}

if ($StartDaemon) {
    Write-Host ""
    Write-Host "      Starting background daemon on port 9749..." -ForegroundColor Cyan
    & $TargetExe daemon start --port=9749
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  MCP executable update complete!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "1. Restart Antigravity IDE (or reload the window) so the IDE starts the updated binary." -ForegroundColor Gray
Write-Host "2. Any subsequent MCP tool calls will be captured in the in-memory ring buffer." -ForegroundColor Gray
Write-Host "3. Open http://localhost:5173/?tab=control to see tool calls in the Tool Call Log." -ForegroundColor Gray
Write-Host ""
