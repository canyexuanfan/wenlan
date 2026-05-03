param(
  [string]$ServerHost = "121.4.65.95",
  [string]$ServerUser = "root",
  [string]$SshKeyPath = "C:\Users\wzm33\.ssh\temp-bqgf-deploy-key",
  [int]$HostPort = 13010,
  [string]$RemoteRoot = "/opt/docker/wenlan-web",
  [string]$AppUrl = "http://nexusapi.hnwen17.top",
  [string]$SupabasePublicUrl = "http://121.4.65.95:18000",
  [ValidateSet("pm2", "docker")]
  [string]$Runtime = "pm2"
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
  "NEXT_PUBLIC_APP_URL=$AppUrl"
  "NEXT_PUBLIC_SUPABASE_URL=$SupabasePublicUrl"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY=$($pairs['NEXT_PUBLIC_SUPABASE_ANON_KEY'])"
  "SUPABASE_SERVICE_ROLE_KEY=$($pairs['SUPABASE_SERVICE_ROLE_KEY'])"
  "SUPABASE_STORAGE_BUCKET=$(if ($pairs['SUPABASE_STORAGE_BUCKET']) { $pairs['SUPABASE_STORAGE_BUCKET'] } else { 'document-assets' })"
  "SUPABASE_THUMBNAIL_BUCKET=$(if ($pairs['SUPABASE_THUMBNAIL_BUCKET']) { $pairs['SUPABASE_THUMBNAIL_BUCKET'] } else { 'document-thumbnails' })"
  "DOCUMENT_STORAGE_DRIVER=$(if ($pairs['DOCUMENT_STORAGE_DRIVER']) { $pairs['DOCUMENT_STORAGE_DRIVER'] } else { 'supabase' })"
  "COS_BUCKET=$(if ($pairs['COS_BUCKET']) { $pairs['COS_BUCKET'] } else { '' })"
  "COS_REGION=$(if ($pairs['COS_REGION']) { $pairs['COS_REGION'] } else { '' })"
  "COS_SECRET_ID=$(if ($pairs['COS_SECRET_ID']) { $pairs['COS_SECRET_ID'] } else { '' })"
  "COS_SECRET_KEY=$(if ($pairs['COS_SECRET_KEY']) { $pairs['COS_SECRET_KEY'] } else { '' })"
  "COS_PUBLIC_BASE_URL=$(if ($pairs['COS_PUBLIC_BASE_URL']) { $pairs['COS_PUBLIC_BASE_URL'] } else { '' })"
  "ADMIN_USERNAME=$(if ($pairs['ADMIN_USERNAME']) { $pairs['ADMIN_USERNAME'] } else { '' })"
  "ADMIN_EMAIL=$(if ($pairs['ADMIN_EMAIL']) { $pairs['ADMIN_EMAIL'] } else { '' })"
  "NEXT_PUBLIC_FORCE_MOCK=false"
  "WENLAN_FORCE_MOCK=false"
) | Set-Content -Path $tempEnvPath -Encoding ASCII

$remoteArchive = "/root/wenlan-web-deploy.tar.gz"
$remoteEnv = "/root/wenlan-web.env"

try {
  scp -i $SshKeyPath $archivePath "${ServerUser}@${ServerHost}:$remoteArchive"
  scp -i $SshKeyPath $tempEnvPath "${ServerUser}@${ServerHost}:$remoteEnv"

  $remoteScript = @'
set -e
runtime="$1"
remote_root="$2"
remote_archive="/root/wenlan-web-deploy.tar.gz"
remote_env="/root/wenlan-web.env"

mkdir -p "$remote_root/app"
mv "$remote_archive" "$remote_root/wenlan-web-deploy.tar.gz"
mv "$remote_env" "$remote_root/wenlan-web.env"
sed -i 's/\r$//' "$remote_root/wenlan-web.env"
rm -rf "$remote_root/app"/*
tar -xzf "$remote_root/wenlan-web-deploy.tar.gz" -C "$remote_root/app"
cp "$remote_root/wenlan-web.env" "$remote_root/app/deploy/.env"
cp "$remote_root/wenlan-web.env" "$remote_root/app/deploy/.env.backup-$(date +%Y%m%d-%H%M%S)"
cd "$remote_root/app/deploy"
if [ "$runtime" = "docker" ]; then
  docker compose -f docker-compose.server.yml up -d --build
  docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'wenlan-web|NAMES' || true
else
  cd "$remote_root/app"
  npm config set registry https://registry.npmmirror.com
  npm ci --no-audit --progress=false
  set -a
  . deploy/.env
  set +a
  npm run build
  pm2 delete wenlan-web >/dev/null 2>&1 || true
  set -a
  . deploy/.env
  set +a
  pm2 start ./node_modules/next/dist/bin/next --name wenlan-web -- start -p "${WENLAN_HOST_PORT:-13010}" -H 0.0.0.0
  pm2 save
  pm2 list
fi
'@

  $remoteScript = $remoteScript -replace "`r`n", "`n"
  $remoteScript | ssh -i $SshKeyPath "${ServerUser}@${ServerHost}" bash -s -- $Runtime $RemoteRoot
}
finally {
  if (Test-Path $tempEnvPath) {
    Remove-Item $tempEnvPath -Force
  }
}
