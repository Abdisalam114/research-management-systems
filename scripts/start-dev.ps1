# Start Jamhuriya RMS — backend + frontend (Windows)
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

Write-Host "Starting backend on http://localhost:5000 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Backend'; npm run dev"

Start-Sleep -Seconds 3

Write-Host "Starting frontend on http://localhost:5173 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Frontend'; npm run dev"

Write-Host ""
Write-Host "Done. Open http://localhost:5173 in your browser."
Write-Host "Ensure MongoDB is running (mongodb://localhost:27017/rms)."
