param(
    [Parameter(Mandatory = $true)]
    [string]$Destination
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceDir = (Resolve-Path (Join-Path $scriptDir "..")).Path

if (-not (Test-Path -LiteralPath $Destination)) {
    New-Item -ItemType Directory -Path $Destination | Out-Null
}

$destinationDir = (Resolve-Path -LiteralPath $Destination).Path
$files = @(
    "AGENT_CLI.md",
    "AGENT_MANDATE.md",
    "AGENT_API.md"
)

foreach ($file in $files) {
    $sourcePath = Join-Path $sourceDir $file
    $linkPath = Join-Path $destinationDir $file

    if (Test-Path -LiteralPath $linkPath) {
        $existing = Get-Item -LiteralPath $linkPath -Force
        if (($existing.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            Remove-Item -LiteralPath $linkPath -Force
        } else {
            throw "Refusing to overwrite existing non-symlink: $linkPath"
        }
    }

    try {
        New-Item -ItemType SymbolicLink -Path $linkPath -Target $sourcePath | Out-Null
    } catch {
        throw "Failed to create symlink at $linkPath. On Windows, file symlinks usually require an elevated shell or Developer Mode. Original error: $($_.Exception.Message)"
    }

    Write-Host "Linked $linkPath -> $sourcePath"
}
