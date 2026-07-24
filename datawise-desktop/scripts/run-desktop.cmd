@echo off
setlocal
cd /d "%~dp0\.."
set "JAR=target\datawise-desktop-4.0.1.jar"
if not exist "%JAR%" (
  echo Missing %JAR%. Run: mvn -q package
  exit /b 1
)
java -cp "%JAR%;target\lib\*" org.apache.datawise.desktop.DatawiseDesktopApp %*
