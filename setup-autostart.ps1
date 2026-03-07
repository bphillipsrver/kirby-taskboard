# KirbyBoard - Auto-Start Setup Script
# Run this PowerShell script as Administrator to enable auto-start on boot

$ErrorActionPreference = "Stop"

$taskBoardPath = "C:\Users\king\.openclaw\workspace\kirby-taskboard"
$vbsPath = "$taskBoardPath\start-server.vbs"
$startupFolder = [Environment]::GetFolderPath("Startup")
$shortcutPath = "$startupFolder\KirbyBoard.lnk"

Write-Host "Setting up KirbyBoard auto-start..." -ForegroundColor Cyan
Write-Host ""

# Check if the VBS file exists
if (-not (Test-Path $vbsPath)) {
    Write-Error "start-server.vbs not found at $vbsPath"
    exit 1
}

# Create the shortcut
$WshShell = New-Object -ComObject WScript.Shell
$shortcut = $WshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $vbsPath
$shortcut.WorkingDirectory = $taskBoardPath
$shortcut.IconLocation = "shell32.dll, 14"
$shortcut.Description = "KirbyBoard Server"
$shortcut.Save()

Write-Host "✅ Auto-start shortcut created at:" -ForegroundColor Green
Write-Host "   $shortcutPath"
Write-Host ""
Write-Host "KirbyBoard will now start automatically when you log in." -ForegroundColor Green
Write-Host ""
Write-Host "To access KirbyBoard from other devices on your network:" -ForegroundColor Cyan
Write-Host "   http://192.168.1.151:3000"
Write-Host ""
Write-Host "To disable auto-start, delete the shortcut from your Startup folder." -ForegroundColor Yellow

# Optional: Start now?
$startNow = Read-Host "Start KirbyBoard now? (y/n)"
if ($startNow -eq 'y' -or $startNow -eq 'Y') {
    Write-Host "Starting server..." -ForegroundColor Cyan
    Start-Process "wscript.exe" -ArgumentList "`"$vbsPath`"" -WindowStyle Hidden
    Write-Host "✅ KirbyBoard started!" -ForegroundColor Green
    Write-Host "   Access: http://192.168.1.151:3000"
}
