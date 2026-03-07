param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"
$envExample = Join-Path $root ".env.example"

if (-not (Test-Path $envExample)) {
  throw ".env.example was not found at $envExample"
}

if (-not (Test-Path $envFile) -or $Force) {
  Copy-Item $envExample $envFile -Force
  Write-Host "Created/updated .env from .env.example"
} else {
  Write-Host ".env already exists. Use -Force to overwrite it."
}

Write-Host "Installing dependencies with npm.cmd..."
Push-Location $root
try {
  & npm.cmd install
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "Local setup complete."
Write-Host "Next steps:"
Write-Host "1) Install/start PostgreSQL locally (if not already running) with:"
Write-Host "   database=petroleum, user=postgres, password=postgres, port=5432"
Write-Host "2) Seed data:"
Write-Host "   `$env:DATABASE_URL='postgres://postgres:postgres@localhost:5432/petroleum'"
Write-Host "   `$env:PGSSL='disable'"
Write-Host "   npm.cmd run seed"
Write-Host "3) Run locally:"
Write-Host "   npm.cmd run dev"
