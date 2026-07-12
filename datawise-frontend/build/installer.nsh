; NSIS hooks for electron-builder — 安装时预置 Windows 防火墙放行（需安装程序以管理员运行）
!macro customHeader
  !define MUI_WELCOMEPAGE_TITLE "欢迎安装 DataWise CLI"
  !define MUI_WELCOMEPAGE_TEXT "本向导将引导您完成 DataWise CLI 的安装。$\r$\n$\r$\nDataWise CLI 是面向数据开发与探索的一体化 SQL 工作台，将连接管理、智能问数与结果导出整合在同一界面。$\r$\n$\r$\n建议继续安装前关闭其它正在运行的 DataWise 实例。"
  !define MUI_FINISHPAGE_TITLE "DataWise CLI 安装完成"
  !define MUI_FINISHPAGE_TEXT "DataWise CLI 已成功安装到您的计算机。$\r$\n$\r$\n点击「完成」即可启动应用，开始连接数据源、编写 SQL 并探索数据。"
!macroend

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
