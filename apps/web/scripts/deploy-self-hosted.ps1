param(
  [string]$ServerHost = "121.4.65.95",
  [string]$ServerUser = "root",
  [string]$SshKeyPath = "C:\Users\wzm33\.ssh\temp-bqgf-deploy-key",
  [int]$HostPort = 13010,
  [string]$RemoteRoot = "/opt/docker/wenlan-web"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$archivePath = Join-Path $projectRoot "wenlan-web-deploy.tar.gz"
$tempEnvPath = Join-Path $projectRoot "wenlan-web-server.env"
$envPath = Join-Path $projectRoot ".env.local"

if (!(Test-Path $envPath)) {
  throw "Missing env file: $envPath"
}

$pairs = @{}
Get-Content $envPath | ForEach-Object {
  if ($_ -match '^([^#=]+)=(.*)$') {
    $pairs[$matches[1].Trim()] = $matches[2]
  }
}

$requiredKeys = @(
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
)

foreach ($key in $requiredKeys) {
  if ([string]::IsNullOrWhiteSpace($pairs[$key])) {
    throw "Missing required key in .env.local: $key"
  }
}

if (Test-Path $archivePath) {
  Remove-Item $archivePath -Force
}

tar.exe -czf $archivePath -C $projectRoot `
  Dockerfile `
  .dockerignore `
  package.json `
  package-lock.json `
  next.config.ts `
  tsconfig.json `
  next-env.d.ts `
  postcss.config.mjs `
  public `
  src `
  deploy

@(
  "NODE_ENV=production"
  "HOSTNAME=0.0.0.0"
  "PORT=3000"
  "WENLAN_HOST_PORT=$HostPort"
  "NEXT_PUBLIC_APP_URL=http://$ServerHost`:$HostPort"
  "NEXT_PUBLIC_SUPABASE_URL=$($pairs['NEXT_PUBLIC_SUPABASE_URL'])"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY=$($pairs['NEXT_PUBLIC_SUPABASE_ANON_KEY'])"
  "SUPABASE_SERVICE_ROLE_KEY=$($pairs['SUPABASE_SERVICE_ROLE_KEY'])"
  "SUPABASE_STORAGE_BUCKET=$(if ($pairs['SUPABASE_STORAGE_BUCKET']) { $pairs['SUPABASE_STORAGE_BUCKET'] } else { 'document-assets' })"
  "SUPABASE_THUMBNAIL_BUCKET=$(if ($pairs['SUPABASE_THUMBNAIL_BUCKET']) { $pairs['SUPABASE_THUMBNAIL_BUCKET'] } else { 'document-thumbnails' })"
  "NEXT_PUBLIC_FORCE_MOCK=false"
  "WENLAN_FORCE_MOCK=false"
) | Set-Content -Path $tempEnvPath -Encoding ASCII

$remoteArchive = "/root/wenlan-web-deploy.tar.gz"
$remoteEnv = "/root/wenlan-web.env"

try {
  scp -i $SshKeyPath $archivePath "${ServerUser}@${ServerHost}:$remoteArchive"
  scp -i $SshKeyPath $tempEnvPath "${ServerUser}@${ServerHost}:$remoteEnv"

  $remoteScript = @"
set -e
mkdir -p $RemoteRoot/app
mv $remoteArchive $RemoteRoot/wenlan-web-deploy.tar.gz
mv $remoteEnv $RemoteRoot/wenlan-web.env
rm -rf $RemoteRoot/app/*
tar -xzf $RemoteRoot/wenlan-web-deploy.tar.gz -C $RemoteRoot/app
cp $RemoteRoot/wenlan-web.env $RemoteRoot/app/deploy/.env
cp $RemoteRoot/wenlan-web.env $RemoteRoot/app/deploy/.env.backup-\$(date +%Y%m%d-%H%M%S)
cd $RemoteRoot/app/deploy
docker compose -f docker-compose.server.yml up -d --build
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'wenlan-web|NAMES' || true
"@

  ssh -i $SshKeyPath "${ServerUser}@${ServerHost}" $remoteScript
}
finally {
  if (Test-Path $tempEnvPath) {
    Remove-Item $tempEnvPath -Force
  }
}
