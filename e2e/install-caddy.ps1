$ErrorActionPreference = 'Stop'
# Match the Caddy version used by the existing local container; verify release checksum.
$version = '2.10.2'
$asset = "caddy_${version}_windows_amd64.zip"
$destination = Join-Path $PSScriptRoot '../.tools'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$archive = Join-Path $destination $asset
$checksums = Join-Path $destination 'caddy-checksums.txt'
$release = "https://github.com/caddyserver/caddy/releases/download/v$version"
Invoke-WebRequest "$release/$asset" -OutFile $archive
Invoke-WebRequest "$release/caddy_${version}_checksums.txt" -OutFile $checksums
$line = Get-Content $checksums | Where-Object { $_ -match ([regex]::Escape($asset) + '$') }
if (@($line).Count -ne 1) { throw 'Missing or ambiguous Caddy release checksum' }
$expected = ($line -split '\s+')[0]
if ($expected -notmatch '^[a-fA-F0-9]{128}$') { throw 'Expected official SHA-512 checksum' }
if ((Get-FileHash -Algorithm SHA512 -LiteralPath $archive).Hash -ne $expected) { throw 'Caddy checksum mismatch' }
Expand-Archive -LiteralPath $archive -DestinationPath $destination -Force
& (Join-Path $destination 'caddy.exe') version
if ($LASTEXITCODE -ne 0) { throw 'Caddy executable validation failed' }
