# 文览自建 Supabase 说明

这套目录的目标不是“把密钥展示一下”，而是把文览的自建 Supabase 变成一套可重复、可备份、可迁移的基础设施流程。

它解决三件事：

- 有明确的环境变量模板。
- 有真实可回收的密钥备份落点。
- 有面向官方 Docker 自建方案的准备脚手架。

## 目录说明

```text
infra/supabase/
├─ .env.self-host.example
├─ README.md
├─ SECRET-BACKUP.md
├─ SECRET-INVENTORY.template.md
├─ runtime/
│  └─ .gitkeep
├─ scripts/
│  └─ supabase-self-host.mjs
└─ sql/
   ├─ 001_wenlan_v1_schema.sql
   └─ 002_storage_bootstrap.sql
```

## 真实会用到的文件

### 1. 部署环境文件

- 模板：`infra/supabase/.env.self-host.example`
- 运行文件：`infra/supabase/runtime/.env.self-host`

### 2. 密钥清单

- 模板：`infra/supabase/SECRET-INVENTORY.template.md`
- 运行文件：`infra/supabase/runtime/SECRET-INVENTORY.md`

### 3. Web 应用本地环境

- 输出文件：`apps/web/.env.local`

## 推荐流程

### 第一步：初始化运行文件

```powershell
node infra/supabase/scripts/supabase-self-host.mjs init
```

### 第二步：生成并备份密钥

```powershell
node infra/supabase/scripts/supabase-self-host.mjs generate-secrets
```

这一步会同时更新：

- `infra/supabase/runtime/.env.self-host`
- `infra/supabase/runtime/SECRET-INVENTORY.md`
- `apps/web/.env.local`

不会只在终端里显示一次后消失。

### 第三步：准备官方 Docker 自建栈

```powershell
node infra/supabase/scripts/supabase-self-host.mjs prepare-official-stack
```

脚本会按 Supabase 官方自建 Docker 指南，把官方 `docker/` 目录复制到本地运行目录，并将文览自己的环境变量和 SQL 一起放进去。

默认输出目录：

- `infra/supabase/runtime/official-stack`

### 第四步：启动官方栈

```powershell
cd infra/supabase/runtime/official-stack
docker compose pull
docker compose up -d
```

### 第五步：执行文览 SQL

Linux / macOS:

```bash
cat wenlan/sql/001_wenlan_v1_schema.sql | docker compose exec -T db psql -U postgres -d postgres
cat wenlan/sql/002_storage_bootstrap.sql | docker compose exec -T db psql -U postgres -d postgres
```

PowerShell:

```powershell
Get-Content wenlan/sql/001_wenlan_v1_schema.sql -Raw | docker compose exec -T db psql -U postgres -d postgres
Get-Content wenlan/sql/002_storage_bootstrap.sql -Raw | docker compose exec -T db psql -U postgres -d postgres
```

## 部署策略建议

- 一台服务器可以跑多个项目。
- 但每个正式产品建议独立一个 Supabase 实例。
- 文览建议实例名：`wenlan-prod`。

原因：

- 数据库隔离更干净。
- Auth 和 Storage 不会与其他产品混用。
- 备份、恢复、迁移更容易。

## 服务器准备建议

- Linux 服务器
- Docker Engine
- Docker Compose
- 最低 4 GB 内存，建议 8 GB 起
- 独立域名或子域名
- HTTPS 证书
- 可用 SMTP 服务

## 特别注意

- 不要在没有备份密钥的前提下重建实例。
- 不要把真实密钥写进 `.example` 文件。
- 不要让多个正式产品复用同一个 Supabase 实例。

## 参考

- Supabase 官方自建 Docker 文档：
  [Self-Hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
- Supabase 官方生成密钥脚本：
  [`docker/utils/generate-keys.sh`](https://raw.githubusercontent.com/supabase/supabase/master/docker/utils/generate-keys.sh)
