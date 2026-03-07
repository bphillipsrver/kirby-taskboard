# Kirby Task Board - Auto-Start Setup Script
# Run this PowerShell script as Administrator to enable auto-start on boot

$ErrorActionPreference = "Stop"

$taskBoardPath = "C:\Users\king\.openclaw\workspace\kirby-taskboard"
$vbsPath = "$taskBoardPath\start-server.vbs"
$startupFolder = [Environment]::GetFolderPath("Startup")
$shortcutPath = "$startupFolder\KirbyTaskBoard.lnk"

Write-Host "Setting up Kirby Task Board auto-start..." -ForegroundColor Cyan
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
$shortcut.Description = "Kirby Task Board Server"
$shortcut.Save()

Write-Host "✅ Auto-start shortcut created at:" -ForegroundColor Green
Write-Host "   $shortcutPath"
Write-Host ""
Write-Host "The task board will now start automatically when you log in." -ForegroundColor Green
Write-Host ""
Write-Host "To access the board from other devices on your network:" -ForegroundColor Cyan
Write-Host "   http://192.168.1.151:3000"
Write-Host ""
Write-Host "To disable auto-start, delete the shortcut from your Startup folder." -ForegroundColor Yellow

# Optional: Start now?
$startNow = Read-Host "Start the server now? (y/n)"
if ($startNow -eq 'y' -or $startNow -eq 'Y') {
    Write-Host "Starting server..." -ForegroundColor Cyan
    Start-Process "wscript.exe" -ArgumentList "`"$vbsPath`"" -WindowStyle Hidden
    Write-Host "✅ Server started!" -ForegroundColor Green
    Write-Host "   Access: http://192.168.1.151:3000"
}
