; NSIS hooks for electron-builder — 安装时预置 Windows 防火墙放行（需安装程序以管理员运行）
!macro customInstall
  DetailPrint "Configuring Windows Firewall for DataWise backend..."
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="DataWise CLI Backend" dir=in action=allow program="$INSTDIR\resources\backend\jre\bin\java.exe" enable=yes profile=any'
  Pop $0
  DetailPrint "Firewall rule exit code: $0"
!macroend

!macro customUnInstall
  DetailPrint "Removing DataWise backend firewall rule..."
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="DataWise CLI Backend"'
  Pop $0
!macroend
