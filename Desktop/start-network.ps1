param(
  [Parameter(Mandatory = $true)]
  [string]$BackendHost
)

# Example:
#   .\start-network.ps1 -BackendHost 192.168.1.20
#
# Keep `npm start` for the normal single-laptop/localhost workflow. This
# launcher is only for a Desktop client running on a different lab PC.
$BackendHost = $BackendHost.Trim()
if ([string]::IsNullOrWhiteSpace($BackendHost) -or $BackendHost -match '[/\s?#]') {
  throw 'Pass the backend PC IPv4 address or LAN hostname, for example: .\start-network.ps1 -BackendHost 192.168.1.20'
}

$env:PROCTR_API_BASE = "http://${BackendHost}:5000/api"
Push-Location $PSScriptRoot
try {
  npm start
} finally {
  Pop-Location
}
