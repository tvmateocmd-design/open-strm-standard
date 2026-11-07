$ErrorActionPreference = 'Stop'
$secret = Read-Host 'Enter your local renterd API password (hidden)' -AsSecureString
$pointer = [IntPtr]::Zero
$oldPassword = [Environment]::GetEnvironmentVariable('RELAYSTREAM_SIA_PASSWORD', 'Process')
try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    $env:RELAYSTREAM_SIA_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    & node (Join-Path $PSScriptRoot 'server.mjs')
} finally {
    [Environment]::SetEnvironmentVariable('RELAYSTREAM_SIA_PASSWORD', $oldPassword, 'Process')
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    $secret.Dispose()
}
