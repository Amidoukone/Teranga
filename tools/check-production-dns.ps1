<#
.SYNOPSIS
Checks the public DNS records and health endpoints for the Teranga production app.

.DESCRIPTION
Public DNS mismatches are treated as failures. Local/default resolver issues are
reported as warnings unless -StrictLocalResolver is used, because a router or ISP
DNS cache can temporarily disagree with public DNS.
#>

[CmdletBinding()]
param(
  [string]$Domain = "teranga-diaspora.com",
  [string]$WwwDomain = "www.teranga-diaspora.com",
  [string]$ExpectedA = "75.2.60.5",
  [string]$ExpectedWwwCname = "teranga.netlify.app",
  [string[]]$PublicDnsServers = @("8.8.8.8", "1.1.1.1"),
  [string]$FrontendUrl = "https://www.teranga-diaspora.com",
  [string]$BackendHealthUrl = "https://teranga-backend.onrender.com/api/health",
  [switch]$StrictLocalResolver
)

$ErrorActionPreference = "Stop"
$failures = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

function Add-Failure {
  param([string]$Message)
  $script:failures.Add($Message) | Out-Null
  Write-Host "[fail] $Message" -ForegroundColor Red
}

function Add-Warning {
  param([string]$Message)
  $script:warnings.Add($Message) | Out-Null
  Write-Host "[warn] $Message" -ForegroundColor Yellow
}

function Write-Check {
  param([string]$Message)
  Write-Host "[check] $Message"
}

function Resolve-TerangaRecord {
  param(
    [string]$Name,
    [string]$Type,
    [string]$Server
  )

  try {
    if ([string]::IsNullOrWhiteSpace($Server)) {
      return @(Resolve-DnsName $Name -Type $Type -ErrorAction Stop)
    }

    return @(Resolve-DnsName $Name -Type $Type -Server $Server -ErrorAction Stop)
  } catch {
    return @()
  }
}

foreach ($server in $PublicDnsServers) {
  Write-Check "Public DNS ${server}: $Domain A"
  $apexARecords = Resolve-TerangaRecord -Name $Domain -Type "A" -Server $server |
    Where-Object { $_.Type -eq "A" -and $_.IPAddress }
  $apexIps = @($apexARecords | ForEach-Object { $_.IPAddress })

  if ($apexIps -contains $ExpectedA) {
    Write-Host "       OK $Domain -> $ExpectedA"
  } else {
    Add-Failure "$Domain does not resolve to $ExpectedA on $server. Got: $($apexIps -join ', ')"
  }

  Write-Check "Public DNS ${server}: $WwwDomain CNAME"
  $wwwCnames = Resolve-TerangaRecord -Name $WwwDomain -Type "CNAME" -Server $server |
    Where-Object { $_.Type -eq "CNAME" -and $_.NameHost } |
    ForEach-Object { $_.NameHost.TrimEnd(".") }

  if ($wwwCnames -contains $ExpectedWwwCname) {
    Write-Host "       OK $WwwDomain -> $ExpectedWwwCname"
  } else {
    Add-Failure "$WwwDomain does not CNAME to $ExpectedWwwCname on $server. Got: $($wwwCnames -join ', ')"
  }
}

Write-Check "Default resolver: $Domain A"
$localARecords = Resolve-TerangaRecord -Name $Domain -Type "A" -Server "" |
  Where-Object { $_.Type -eq "A" -and $_.IPAddress }
$localIps = @($localARecords | ForEach-Object { $_.IPAddress })

if ($localIps -contains $ExpectedA) {
  Write-Host "       OK $Domain -> $ExpectedA"
} else {
  $message = "Default resolver does not return $ExpectedA for $Domain. Got: $($localIps -join ', ')"
  if ($StrictLocalResolver) {
    Add-Failure $message
  } else {
    Add-Warning $message
  }
}

Write-Check "Default resolver: $WwwDomain CNAME"
$localWwwCnames = Resolve-TerangaRecord -Name $WwwDomain -Type "CNAME" -Server "" |
  Where-Object { $_.Type -eq "CNAME" -and $_.NameHost } |
  ForEach-Object { $_.NameHost.TrimEnd(".") }

if ($localWwwCnames -contains $ExpectedWwwCname) {
  Write-Host "       OK $WwwDomain -> $ExpectedWwwCname"
} else {
  $message = "Default resolver does not return $ExpectedWwwCname for $WwwDomain. Got: $($localWwwCnames -join ', ')"
  if ($StrictLocalResolver) {
    Add-Failure $message
  } else {
    Add-Warning $message
  }
}

Write-Check "Backend health: $BackendHealthUrl"
try {
  $backendResponse = Invoke-WebRequest -Uri $BackendHealthUrl -Method Head -TimeoutSec 20 -ErrorAction Stop
  if ([int]$backendResponse.StatusCode -ge 200 -and [int]$backendResponse.StatusCode -lt 400) {
    Write-Host "       OK backend returned $($backendResponse.StatusCode)"
  } else {
    Add-Failure "Backend returned HTTP $($backendResponse.StatusCode)"
  }
} catch {
  Add-Failure "Backend health check failed: $($_.Exception.Message)"
}

Write-Check "Frontend reachability through default resolver: $FrontendUrl"
try {
  $frontendResponse = Invoke-WebRequest -Uri $FrontendUrl -Method Head -TimeoutSec 20 -ErrorAction Stop
  if ([int]$frontendResponse.StatusCode -ge 200 -and [int]$frontendResponse.StatusCode -lt 400) {
    Write-Host "       OK frontend returned $($frontendResponse.StatusCode)"
  } else {
    Add-Warning "Frontend returned HTTP $($frontendResponse.StatusCode)"
  }
} catch {
  $message = "Frontend check failed through the default resolver: $($_.Exception.Message)"
  if ($StrictLocalResolver) {
    Add-Failure $message
  } else {
    Add-Warning $message
  }
}

if ($failures.Count -gt 0) {
  Write-Host ""
  Write-Host "Production DNS check failed with $($failures.Count) blocking issue(s)." -ForegroundColor Red
  exit 1
}

Write-Host ""
if ($warnings.Count -gt 0) {
  Write-Host "Production DNS check passed with $($warnings.Count) warning(s)." -ForegroundColor Yellow
  Write-Host "If Chrome shows DNS_PROBE_FINISHED_NXDOMAIN while public DNS is OK, flush DNS and fix the router/ISP resolver."
} else {
  Write-Host "Production DNS check passed." -ForegroundColor Green
}
