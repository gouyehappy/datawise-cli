# 停止本地前后端 dev 服务
$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Split-Path -Parent $scriptDir)
node "$scriptDir/dev-stop.mjs" @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
