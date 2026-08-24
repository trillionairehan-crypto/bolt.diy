# overnight-loop.ps1 - Coralred overnight infinite loop
Set-Location "C:\Users\hlapu\korean-ai-builder\bolt.diy"
$cycle = 0
while ($true) {
    if (Test-Path ".\STOP.txt") {
        Write-Host "STOP.txt found - loop finished"
        break
    }
    $cycle++
    $stamp = Get-Date -Format "MM-dd HH:mm:ss"
    Write-Host ""
    Write-Host "===== CYCLE $cycle START ($stamp) ====="
    claude -p "Read the file overnight-cycle.md in the current directory and follow its instructions for exactly ONE cycle, then finish." --dangerously-skip-permissions 2>&1 | Tee-Object -FilePath ".\overnight-loop.log" -Append
    Write-Host "===== CYCLE $cycle END ====="
    Start-Sleep -Seconds 15
}