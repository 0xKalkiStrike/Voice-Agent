Write-Host "Starting AURA Backend..."
Start-Process python -ArgumentList "-m uvicorn backend.main:app --host 0.0.0.0 --port 8000"

Write-Host "Starting AURA Frontend..."
Start-Process npm -ArgumentList "run dev"
