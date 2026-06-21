# 文览 Wenlan

> 把各种文档，做成可阅读、可检索、可控权限的在线展台。

文览是一个文档库与轻量内容管理系统。导入 HTML 和 Markdown 文档，像文件资源管理器一样分门别类地组织，并通过管理员 / 用户角色与邀请注册控制访问。适合团队把 SOP、教程、方案、报告、手册、知识卡片等文档统一上线展示。

## ✨ 特性

**文档管理**
- 文件夹与文档的多级组织，支持卡片视图与列表视图切换
- 导入 HTML 与 Markdown 文档
- 导入文档可选「源格式渲染」，保留原始排版
- 响应式公开文库 + 管理后台

**权限与访问**
- 邮箱验证 + 邀请码注册，可控谁能加入
- 管理员 / 用户角色，细粒度访问控制
- 管理员可用短用户名登录，真实账号信息不进源码

**存储与后端**
- Supabase 提供认证、数据库（Postgres）与文档存储
- 可选腾讯云对象存储 COS 存放文档文件与资源

## 🧱 技术栈

- **框架**：[Next.js](https://nextjs.org/) (React)
- **后端即服务**：[Supabase](https://supabase.com/)（Auth + Postgres + Storage）
- **文档处理**：[markdown-it](https://github.com/markdown-it/markdown-it)（Markdown 渲染）、[cheerio](https://cheerio.js.org/)（导入 HTML 的解析与清洗）
- **对象存储**：腾讯云 COS（[cos-nodejs-sdk-v5](https://github.com/tencentyun/cos-nodejs-sdk-v5)，可选）

## 🚀 本地开发

```bash
cd apps/web
cp .env.example .env.local      # Windows 用 copy
npm install
npm run dev:local
```

`npm run dev:local` 需要本地 Supabase 已就绪（仓库内含 `supabase:local` 等脚本）。真实密钥只放在本地环境文件或部署平台的密钥存储里，**不要提交**。

## ⚙️ 配置

应用从环境变量读取以下配置：

**Supabase**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `SUPABASE_THUMBNAIL_BUCKET`

**对象存储（可选）**
- `DOCUMENT_STORAGE_DRIVER` — 设为 `cos` 启用腾讯云 COS
- `COS_BUCKET` / `COS_REGION` / `COS_SECRET_ID` / `COS_SECRET_KEY`
- `COS_PUBLIC_BASE_URL` — 可选，留空用 COS 默认域名，或填 CDN / 自定义域名

**管理员**
- `ADMIN_USERNAME` / `ADMIN_EMAIL` — 可选，让一位管理员用短用户名登录

## 📁 目录结构

```
.
├── apps/
│   └── web/                Next.js 应用（@wenlan/web）
├── Prd.md                  文览产品需求文档
├── KnowledgeBase-PRD.md    智能知识库（规划中）增量 PRD
└── LICENSE
```

## 🗺️ 路线图

文览定位不变，继续负责文档展示、文件夹 / 文档管理与权限控制。后续规划（见 `KnowledgeBase-PRD.md`）在此基础上叠加「智能知识库引擎」：文档解析、索引、检索、RAG 问答、引用与结构化沉淀。

## 🔒 发布前安全清单

- 不要提交 `.env`、`.env.local`、Supabase 运行时目录、生成的归档或密钥清单
- 任何流出过私密存储的凭据，发布前轮换
- 生产密钥只放在托管平台、服务器环境或专用密钥管理服务里

## 📄 开源协议

[MIT License](./LICENSE)
