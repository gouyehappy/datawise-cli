# DataWise 提交前检查（PowerShell）
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Split-Path -Parent $scriptDir)
node "$scriptDir/sop/pre-commit-check.mjs" @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
