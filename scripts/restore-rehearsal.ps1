[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupDirectory
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$docker = if ($dockerCommand) { $dockerCommand.Source } else { "C:\Program Files\Docker\Docker\resources\bin\docker.exe" }
if (-not (Test-Path -LiteralPath $docker -PathType Leaf)) {
  throw "Docker를 찾을 수 없습니다. Docker Desktop을 설치하고 다시 실행해 주세요."
}

$resolvedBackup = (Resolve-Path $BackupDirectory).Path
$dumpPath = Join-Path $resolvedBackup "postgres.dump"
$metadataPath = Join-Path $resolvedBackup "file-metadata.csv"
$objectManifestPath = Join-Path $resolvedBackup "object-manifest.jsonl"
foreach ($requiredPath in @($dumpPath, $metadataPath, $objectManifestPath)) {
  if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) { throw "복구 리허설 파일이 없습니다: $requiredPath" }
}

$stamp = Get-Date -Format "yyyyMMddHHmmss"
$rehearsalDatabase = "project_hub_restore_$stamp"
$user = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "project_hub" }
$containerDump = "/tmp/$rehearsalDatabase.dump"

try {
  & $docker cp $dumpPath "project-hub-postgres:$containerDump"
  if ($LASTEXITCODE -ne 0) { throw "복구 파일 전송에 실패했습니다." }
  & $docker compose exec -T postgres createdb -U $user $rehearsalDatabase
  if ($LASTEXITCODE -ne 0) { throw "리허설 데이터베이스 생성에 실패했습니다." }
  & $docker compose exec -T postgres pg_restore -U $user -d $rehearsalDatabase --exit-on-error --no-owner --no-acl $containerDump
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL 복구 리허설에 실패했습니다." }

  $integritySql = "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM projects; SELECT COUNT(*) FROM audit_logs;"
  & $docker compose exec -T postgres psql -U $user -d $rehearsalDatabase -v ON_ERROR_STOP=1 -c $integritySql
  if ($LASTEXITCODE -ne 0) { throw "복구 데이터 무결성 확인에 실패했습니다." }

  $metadata = @(Import-Csv -LiteralPath $metadataPath | Where-Object { $_.status -eq "AVAILABLE" })
  $objectKeys = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
  Get-Content -LiteralPath $objectManifestPath | Where-Object { $_.Trim() } | ForEach-Object {
    $entry = $_ | ConvertFrom-Json
    $candidates = @()
    if ($entry.PSObject.Properties.Name -contains "key") { $candidates += $entry.key }
    if ($entry.PSObject.Properties.Name -contains "name") { $candidates += $entry.name }
    foreach ($candidate in $candidates) {
      if ($candidate) { [void]$objectKeys.Add([string]$candidate) }
    }
  }
  $missing = @($metadata | Where-Object {
    $key = [string]$_.storage_key
    -not $objectKeys.Contains($key) -and -not ($objectKeys | Where-Object { $_.EndsWith("/$key") })
  })
  if ($missing.Count -gt 0) {
    $sample = ($missing | Select-Object -First 10 -ExpandProperty storage_key) -join ", "
    throw "파일 메타데이터와 객체 저장소가 일치하지 않습니다. 누락 $($missing.Count)건: $sample"
  }

  Write-Output "복구 리허설 성공: DB 복원 및 AVAILABLE 파일 $($metadata.Count)건 대조 완료"
}
finally {
  & $docker compose exec -T postgres dropdb -U $user --if-exists $rehearsalDatabase 2>$null
  & $docker compose exec -T postgres rm -f $containerDump 2>$null
}
