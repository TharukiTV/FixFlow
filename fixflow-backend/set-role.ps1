param(
    [Parameter(Mandatory=$true)][string]$Email,
    [Parameter(Mandatory=$true)][ValidateSet('USER','TECHNICIAN','ADMIN')][string]$Role,
    [string]$Database = 'fixflow',
    [string]$DatabaseUser = 'postgres'
)
$ErrorActionPreference = 'Stop'
$psqlPath = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
if (-not (Test-Path -LiteralPath $psqlPath)) { throw 'PostgreSQL psql was not found. Set its path in set-role.ps1.' }
& $psqlPath -X -W -h localhost -U $DatabaseUser -d $Database -v "email=$Email" -v "role=$($Role.ToUpperInvariant())" -f (Join-Path $PSScriptRoot 'scripts/set-role.sql')
if ($LASTEXITCODE -ne 0) { throw 'Role update failed. See the PostgreSQL error above.' }
Write-Host 'UPDATE 1 means the account was updated. UPDATE 0 means no matching account exists. Refresh the website to load the current role.'
