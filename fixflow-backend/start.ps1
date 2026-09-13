$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$previousPassword = $env:DB_PASSWORD
try {
    if (-not $env:DB_PASSWORD) {
        $securePassword = Read-Host 'PostgreSQL password (hidden)' -AsSecureString
        $env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
    }
    & mvn '-Dmaven.repo.local=../.maven' spring-boot:run
    if ($LASTEXITCODE -ne 0) { throw 'Backend exited with an error. Read the Maven/Spring Boot error above. If port 8080 is in use, stop the previous backend with Ctrl+C and try again.' }
} finally {
    $env:DB_PASSWORD = $previousPassword
}
