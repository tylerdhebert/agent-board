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

function New-AgentSymlink {
    param(
        [string]$SourcePath,
        [string]$LinkPath,
        [bool]$IsDirectory = $false
    )

    if (Test-Path -LiteralPath $LinkPath) {
        $existing = Get-Item -LiteralPath $LinkPath -Force
        if (($existing.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            Remove-Item -LiteralPath $LinkPath -Force -Recurse
        } else {
            throw "Refusing to overwrite existing non-symlink: $LinkPath"
        }
    }

    $type = if ($IsDirectory) { "Junction" } else { "SymbolicLink" }
    try {
        New-Item -ItemType $type -Path $LinkPath -Target $SourcePath | Out-Null
    } catch {
        throw "Failed to create symlink at $LinkPath. On Windows, symlinks usually require an elevated shell or Developer Mode. Original error: $($_.Exception.Message)"
    }

    Write-Host "Linked $LinkPath -> $SourcePath"
}

# Link individual markdown files
$files = @(
    "AGENT_MANDATE.md",
    "AGENT_API.md",
    "ORCHESTRATOR.md",
    "BOARD_AGENT.md"
)

foreach ($file in $files) {
    $sourcePath = Join-Path $sourceDir $file
    $linkPath = Join-Path $destinationDir $file
    New-AgentSymlink -SourcePath $sourcePath -LinkPath $linkPath
}

# Link skills subdirectories into <destination>\skills\
$skillsSource = Join-Path $sourceDir "skills"
$skillsDest = Join-Path $destinationDir "skills"

if (-not (Test-Path -LiteralPath $skillsDest)) {
    New-Item -ItemType Directory -Path $skillsDest | Out-Null
}

foreach ($skillDir in Get-ChildItem -LiteralPath $skillsSource -Directory) {
    $sourcePath = $skillDir.FullName
    $linkPath = Join-Path $skillsDest $skillDir.Name
    New-AgentSymlink -SourcePath $sourcePath -LinkPath $linkPath -IsDirectory $true
}
