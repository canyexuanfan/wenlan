Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-DockerExe {
  $dockerCommand = Get-Command docker -ErrorAction SilentlyContinue

  if ($dockerCommand) {
    return $dockerCommand.Source
  }

  $fallback = "E:\Program\Docker\Docker\resources\bin\docker.exe"

  if (Test-Path $fallback) {
    return $fallback
  }

  throw "Docker executable not found. Start Docker Desktop or add docker.exe to PATH."
}

$dockerExe = Get-DockerExe
$stackRoot = Split-Path -Parent $PSScriptRoot

function Invoke-SqlFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SqlFile
  )

  $rootSqlPath = Join-Path $stackRoot "..\..\sql\$SqlFile"
  $runtimeSqlPath = Join-Path $PSScriptRoot "sql\$SqlFile"
  $localSqlPath = if (Test-Path $rootSqlPath) { $rootSqlPath } else { $runtimeSqlPath }
  $containerSqlPath = "/tmp/$SqlFile"

  & $dockerExe cp $localSqlPath "supabase-db:$containerSqlPath"
  & $dockerExe compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f $containerSqlPath
}

Push-Location $stackRoot
try {
  $schemaExists = & $dockerExe compose exec -T db psql -t -A -U postgres -d postgres -c "select to_regclass('app.site_settings') is not null;"

  if ($schemaExists.Trim() -ne "t") {
    Invoke-SqlFile -SqlFile "001_wenlan_v1_schema.sql"
  }

  Invoke-SqlFile -SqlFile "002_storage_bootstrap.sql"
  Invoke-SqlFile -SqlFile "003_postgrest_permissions.sql"
  Invoke-SqlFile -SqlFile "004_login_content_policies.sql"
  Invoke-SqlFile -SqlFile "005_document_render_mode.sql"
  Invoke-SqlFile -SqlFile "006_access_driven_visibility.sql"
  Invoke-SqlFile -SqlFile "007_document_render_cache.sql"
  Invoke-SqlFile -SqlFile "008_invite_email_optional.sql"
}
finally {
  Pop-Location
}
