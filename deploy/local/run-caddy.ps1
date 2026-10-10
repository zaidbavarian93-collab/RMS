# تشغيل Caddy بدون Docker على ويندوز أمام خادم RMS يعمل على المنفذ 4000 (npm run local)
#   ثبّت Caddy:  winget install CaddyServer.Caddy
#   الاستخدام (PowerShell كمسؤول):  .\deploy\local\run-caddy.ps1 -RmsHost 192.168.1.10
param([Parameter(Mandatory = $true)][string]$RmsHost, [string]$Upstream = "localhost:4000")
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Get-Command caddy -ErrorAction SilentlyContinue)) { throw "ثبّت Caddy أولًا: winget install CaddyServer.Caddy" }
$env:RMS_HOST = $RmsHost
$env:RMS_UPSTREAM = $Upstream
$env:XDG_DATA_HOME = Join-Path $here "caddy-data"
$env:XDG_CONFIG_HOME = Join-Path $here "caddy-config"
$env:RMS_CA_DIR = Join-Path $env:XDG_DATA_HOME "caddy\pki\authorities\local"
$env:RMS_SETUP_DIR = $here
Write-Host "صفحة إعداد الأجهزة: http://$RmsHost/    النظام: https://$RmsHost/"
caddy run --config (Join-Path $here "Caddyfile") --adapter caddyfile
