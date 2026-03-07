' Run Kirby Task Board Server silently
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c ""C:\Users\king\.openclaw\workspace\kirby-taskboard\start-server.bat""", 0, False
Set WshShell = Nothing
