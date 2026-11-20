[CmdletBinding()]
param(
  [string]$OutputRoot = "artifacts/backups"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$docker = if ($dockerCommand) { $dockerCommand.Source } else { "C:\Program Files\Docker\Docker\resources\bin\docker.exe" }
if (-not (Test-Path -LiteralPath $docker -PathType Leaf)) {
  throw "Docker를 찾을 수 없습니다. Docker Desktop을 설치하고 다시 실행해 주세요."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDirectory = Join-Path $OutputRoot $stamp
$resolvedWorkspace = (Resolve-Path ".").Path
$absoluteBackupDirectory = [System.IO.Path]::GetFullPath((Join-Path $resolvedWorkspace $backupDirectory))
if (-not $absoluteBackupDirectory.StartsWith($resolvedWorkspace, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "백업 경로는 저장소 내부여야 합니다."
}
New-Item -ItemType Directory -Path $absoluteBackupDirectory -Force | Out-Null

$database = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "project_hub" }
$user = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "project_hub" }
$bucket = if ($env:S3_BUCKET) { $env:S3_BUCKET } else { "project-hub-local" }
$containerDump = "/tmp/project-hub-$stamp.dump"
$containerMetadata = "/tmp/project-hub-$stamp-files.csv"

try {
  & $docker compose exec -T postgres pg_dump -U $user -d $database --format=custom --no-owner --no-acl --file=$containerDump
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL 백업 생성에 실패했습니다." }
  & $docker cp "project-hub-postgres:$containerDump" (Join-Path $absoluteBackupDirectory "postgres.dump")
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL 백업 파일 복사에 실패했습니다." }

  $metadataQuery = "\copy (SELECT 'feed' AS source, storage_key, size, status::text FROM feed_attachments UNION ALL SELECT 'drive', storage_key, size, status::text FROM drive_file_versions UNION ALL SELECT 'calendar', storage_key, size, status::text FROM calendar_event_attachments) TO '$containerMetadata' CSV HEADER"
  & $docker compose exec -T postgres psql -U $user -d $database -v ON_ERROR_STOP=1 -c $metadataQuery
  if ($LASTEXITCODE -ne 0) { throw "파일 메타데이터 내보내기에 실패했습니다." }
  & $docker cp "project-hub-postgres:$containerMetadata" (Join-Path $absoluteBackupDirectory "file-metadata.csv")

  $objectsJson = & $docker compose run --rm -T --entrypoint aws object-storage-init --endpoint-url http://object-storage:9000 s3api list-objects-v2 --bucket $bucket --output json
  if ($LASTEXITCODE -ne 0) { throw "객체 저장소 목록 생성에 실패했습니다." }
  $objects = $objectsJson | ConvertFrom-Json
  $objectEntries = if ($objects.PSObject.Properties.Name -contains "Contents") { @($objects.Contents) } else { @() }
  $objectManifestLines = @($objectEntries | ForEach-Object { @{ key = $_.Key } | ConvertTo-Json -Compress })
  Set-Content -Encoding UTF8 -LiteralPath (Join-Path $absoluteBackupDirectory "object-manifest.jsonl") -Value $objectManifestLines

  $manifest = [ordered]@{
    createdAt = (Get-Date).ToUniversalTime().ToString("o")
    database = $database
    bucket = $bucket
    postgresSha256 = (Get-FileHash (Join-Path $absoluteBackupDirectory "postgres.dump") -Algorithm SHA256).Hash.ToLowerInvariant()
  }
  $manifest | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $absoluteBackupDirectory "manifest.json")
  Write-Output "백업 완료: $absoluteBackupDirectory"
}
finally {
  & $docker compose exec -T postgres rm -f $containerDump $containerMetadata 2>$null
}
