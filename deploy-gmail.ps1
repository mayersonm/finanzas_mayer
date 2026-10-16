# Sube el codigo y actualiza la implementacion web del bot (misma URL).
$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$log  = Join-Path $raiz 'deploy-gmail.log'
Set-Location (Join-Path $raiz 'apps-script')
Start-Transcript -Path $log -Force | Out-Null

Write-Host "== clasp version"; clasp -v
Write-Host "== clasp push"; clasp push -f
# Implementacion del bot, la misma que usa AYUDA.txt
$id = 'AKfycby96cGWN27al7L34RA6uCfoysYjuGNcMBX3Gzx3KWM1XP-35NL2J1nYe8bxOz5UIs8j'
Write-Host "== actualizando $id"
clasp deploy -i $id -d "lector gmail"
if ($LASTEXITCODE -ne 0) { Write-Host "== reintento con update-deployment"; clasp update-deployment $id -d "lector gmail" }
Write-Host "== resultado"; clasp deployments
Write-Host "== FIN"
Stop-Transcript | Out-Null
