$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$pythonPath = Join-Path $PSScriptRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw 'Create the virtual environment and install requirements first. See README.md.'
}
$previousKey = $env:GEMINI_API_KEY
try {
    if ($env:AI_MODE -ne 'demo' -and -not $env:GEMINI_API_KEY) {
        $secureKey = Read-Host 'Gemini API key (paste here; characters are masked)' -AsSecureString
        $env:GEMINI_API_KEY = [System.Net.NetworkCredential]::new('', $secureKey).Password
        if ([string]::IsNullOrWhiteSpace($env:GEMINI_API_KEY)) { throw 'The API key cannot be blank. Run .\start.ps1 again and paste your Gemini API key at the prompt.' }
    }
    & $pythonPath -m uvicorn app.main:app --host 127.0.0.1 --port 8000
    if ($LASTEXITCODE -ne 0) { throw 'Python service stopped with an error. Check the output above.' }
} finally {
    $env:GEMINI_API_KEY = $previousKey
}
