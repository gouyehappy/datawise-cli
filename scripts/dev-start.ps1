# 启动本地前后端（Spring Boot + Electron/Vite）
$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Split-Path -Parent $scriptDir)
node "$scriptDir/dev-start.mjs" @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
