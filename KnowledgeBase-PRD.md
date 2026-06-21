# 文览智能知识库体系 PRD

> 本文档是对原 `Prd.md` 的增量规划，不覆盖原文览 PRD。
> 原 `Prd.md` 继续作为“文览文档展示与内容管理平台”的基础规划；本文档定义“知识库引擎 + 多入口产品体系”的完整后续路线。

## 1. 产品体系定位

### 1.1 一句话定位

把不同来源的资料，变成可展示、可管理、可问答、可引用、可审计的智能知识库。

### 1.2 核心抽象

```text
知识库引擎 = 文档解析 + 索引 + 检索 + RAG问答 + 引用 + 结构化沉淀 + 行业增强

文览 + 知识库引擎 = 企业多人知识库
Obsidian + 知识库引擎 = 个人本地知识库
桌面端 + 知识库引擎 = 离线/本地私有知识库
```

### 1.3 产品边界

文览不改定位，不变成 Obsidian 替代品。

文览继续负责：

- 文档展示
- 文件夹/文档管理
- 权限控制
- 发布与分享
- 后台管理
- 可信引用页面

知识库引擎负责：

- 文档解析
- 文档切块
- 全文检索
- 向量检索
- 混合检索
- RAG 问答
- 引用来源
- 问答日志
- LLM Wiki 式知识沉淀
- GraphRAG 行业增强
- Agent 记忆扩展

Obsidian 入口负责：

- 个人本地 Markdown/Vault 读取
- 双链、标签、frontmatter 解析
- 本地问答
- 本地知识沉淀
- 可选同步/发布到文览

## 2. 产品目标

### 2.1 总目标

构建一个可复用的知识库引擎，使文览的每个文件夹、Obsidian 的每个 Vault、桌面端选择的每个本地目录，都可以成为一个独立知识库。

### 2.2 阶段目标

第一阶段：让文览每个文件夹都可以独立问答。

第二阶段：让文览知识库支持文档解析、全文检索、向量检索、引用来源和问答日志。

第三阶段：支持 Obsidian 个人知识库入口。

第四阶段：支持桌面端本地知识库。

第五阶段：支持医药、保险、法律、制造等行业模板和 GraphRAG 增强。

## 3. 用户画像

### 3.1 企业知识管理员

需求：

- 维护企业文档、SOP、制度、FAQ、产品资料。
- 希望每个文件夹都能变成独立知识库。
- 需要权限、审计、问答记录和人工审核。

痛点：

- 文档散乱。
- 搜索不准。
- 新员工/客服反复问相同问题。
- AI 回答无法追溯来源。

### 3.2 企业客服/业务人员

需求：

- 在指定知识库范围内快速提问。
- 回答要准确、简洁、可引用。
- 找不到答案时转人工或生成工单。

痛点：

- 不知道资料在哪个文件夹。
- 手动查文档耗时。
- 客服话术不统一。

### 3.3 企业管理者/合规负责人

需求：

- 确保 AI 不越权、不瞎编。
- 查看高风险问题、低置信度回答和人工接管记录。
- 对医药、法律、保险等高风险行业启用规则。

痛点：

- AI 输出不可控。
- 缺少审计留痕。
- 权限和知识边界容易混乱。

### 3.4 个人知识工作者

需求：

- 用 Obsidian 管理本地笔记。
- 在本地 Vault 内问答。
- 把高频问答沉淀成 Markdown。
- 可选把个人知识发布到文览。

痛点：

- 笔记越多越难找。
- 双链有结构，但问答能力弱。
- 不想把个人资料上传到云端。

## 4. 核心产品形态

### 4.1 Wenlan Web

定位：企业多人知识库入口。

能力：

- 文件夹即知识库
- 文件夹级问答入口
- 文档级问答入口
- 知识库配置
- 权限继承
- 引用来源页
- 索引状态展示
- 问答日志
- 管理员审核

### 4.2 KB Engine

定位：统一知识库引擎。

能力：

- 文档解析
- 切块
- 索引
- 检索
- 问答
- 引用
- 日志
- 行业规则
- 插件式连接器

### 4.3 Obsidian Connector

定位：个人本地知识库入口。

能力：

- 扫描 Vault
- 读取 Markdown
- 解析 `[[双链]]`
- 解析标签
- 解析 frontmatter
- 本地向量索引
- 本地问答
- 回答引用笔记路径和标题
- 高频问答生成新笔记

### 4.4 Desktop App

定位：本地离线知识库。

能力：

- 选择本地文件夹作为知识库
- 本地文档解析
- 本地索引
- 本地模型接入
- 可选同步到文览
- 可选导出知识包

### 4.5 API/SDK

定位：外部系统集成。

能力：

- 企业微信/飞书/钉钉客服接入
- 官网客服接入
- 工单系统接入
- CRM/ERP/OA 接入
- Webhook
- API Token

## 5. 核心概念模型

### 5.1 Folder

文览已有概念。用于展示和管理内容结构。

### 5.2 KnowledgeBase

知识库实例。通常绑定一个 Folder，也可以绑定 Obsidian Vault 或本地目录。

```text
KnowledgeBase
- id
- sourceType: wenlan_folder / obsidian_vault / local_folder / external
- sourceId
- displayName
- description
- ownerId
- enabled
- retrievalMode
- industryType
- riskPolicy
- createdAt
- updatedAt
```

### 5.3 Document

知识库中的可引用文档。文览 Document 是企业端主要来源。

### 5.4 Chunk

用于检索和问答的知识片段。

```text
DocumentChunk
- id
- knowledgeBaseId
- documentId
- sourcePath
- title
- headingPath
- content
- contentHash
- tokenCount
- metadata
- visibilitySnapshot
- createdAt
```

### 5.5 Citation

AI 回答引用来源。

```text
Citation
- documentId
- chunkId
- title
- routePath
- heading
- quote
- score
```

### 5.6 KnowledgeArtifact

从问答或原始资料沉淀出的知识成果。

类型：

- FAQ
- SOP
- Wiki 页面
- 实体卡片
- 风险规则
- 行业模板

## 6. 技术栈设计

### 6.1 文览 Web 技术栈

沿用现有：

```text
Next.js App Router
TypeScript
React
PostgreSQL / Supabase
Supabase Auth
Supabase Storage / COS / S3 / MinIO
Cheerio
markdown-it
自定义设计系统
```

新增：

```text
KnowledgeBase API
索引状态 UI
问答组件
引用来源组件
知识库配置后台
```

### 6.2 文档解析层

候选技术：

```text
Docling
MinerU
Unstructured
PaddleOCR
Cheerio
markdown-it
```

职责：

- PDF 解析
- Word/PPT/Excel 解析
- HTML 清洗
- Markdown 标准化
- 表格抽取
- OCR
- 生成中间结构 JSON

### 6.3 检索索引层

V1.5 起步：

```text
PostgreSQL FTS
pgvector
BM25/关键词检索
Hybrid Search
```

规模扩大后：

```text
Qdrant
Milvus
Elasticsearch / OpenSearch
```

### 6.4 RAG 编排层

建议自研轻量编排，不把核心绑死在第三方产品。

参考项目：

```text
AnythingLLM
RAGFlow
Dify
FastGPT
LlamaIndex
Haystack
```

核心流程：

```text
用户问题
-> 确定知识库范围
-> 权限校验
-> 查询重写
-> 混合检索
-> rerank
-> 组装上下文
-> 风险策略检查
-> LLM 生成
-> 引用来源
-> 日志记录
```

### 6.5 模型网关

支持多供应商：

```text
OpenAI
DeepSeek
通义千问
豆包
智谱
Ollama
LM Studio
本地 OpenAI-compatible endpoint
```

模型网关职责：

- chat completion
- embedding
- rerank
- streaming
- 成本统计
- 超时重试
- provider fallback

### 6.6 LLM Wiki 知识沉淀层

用到豆包对话中提到的 LLM Wiki 思想。

定位：

- 不是替代 RAG。
- 是把高价值知识沉淀成可维护页面。

实现：

```text
Markdown/Wiki 页面
实体卡片
FAQ 页面
SOP 页面
版本历史
人工审核
Git-like diff
```

可参考：

```text
llm-wiki-compiler
nvk/llm-wiki
```

### 6.7 GraphRAG 行业增强层

用到豆包对话中提到的 Graph RAG。

适用行业：

- 医药
- 保险
- 法律
- 制造
- 设备维修
- 金融风控

候选技术：

```text
Neo4j
LightRAG
KAG
Microsoft GraphRAG
Neo4j GraphRAG Python
Graphiti
```

医药示例关系：

```text
药品 -> 适应症
药品 -> 禁忌
药品 -> 不良反应
药品 -> 特殊人群
药品 -> 相互作用
疾病 -> 推荐用药
症状 -> 风险等级
问题 -> 人工接管规则
```

### 6.8 Agentic Search 精确检索层

用到豆包对话中提到的 Agentic Search。

定位：

- 不是默认主检索链路。
- 用于复杂问题、精确原文定位、本地文件探索。

能力：

- 搜文件名
- 搜标题
- 搜原文
- 读取完整文档
- 多轮补充检索
- 返回查找路径

### 6.9 Agent 记忆层

用到豆包对话中提到的 GBrain。

定位：

- 不直接作为普通客服主链路。
- 作为后台运营助手、药师助手、客服质检助手、个人长期记忆。

候选技术：

```text
GBrain
mem0
Zep
Graphiti
```

用途：

- 客服质检
- 运营记忆
- 药师审核上下文
- 客户历史偏好
- 知识更新提醒

### 6.10 桌面端技术栈

优先：

```text
Tauri
SQLite / DuckDB
LanceDB / Qdrant local
Ollama
本地文件系统
```

备选：

```text
Electron
Chroma
LM Studio
```

## 7. 系统架构

### 7.1 总体架构

```text
                 +-------------------+
                 |    Wenlan Web     |
                 | 企业展示/权限/后台 |
                 +---------+---------+
                           |
                           | Wenlan API / Webhook
                           |
+--------------------------v--------------------------+
|                     KB Engine                       |
| parser / chunker / indexer / retrieval / RAG / log  |
+-------------+----------------------+----------------+
              |                      |
              |                      |
       +------v------+        +------v------+
       | Vector/FTS  |        | Graph Store |
       | pgvector    |        | Neo4j/KAG   |
       +-------------+        +-------------+
              ^
              |
    +---------+----------+
    |                    |
+---v--------------+ +---v----------------+
| Obsidian Plugin  | | Desktop Local App  |
| 个人 Vault        | | 本地文件夹知识库     |
+------------------+ +--------------------+
```

### 7.2 文览与 KB Engine 解耦

文览是知识资产源、权限源、展示源、引用源。

KB Engine 是索引、检索和问答服务。

文览提供：

```text
GET /api/kb/folders
GET /api/kb/folders/:id
GET /api/kb/folders/:id/documents
GET /api/kb/documents/:id
GET /api/kb/documents/:id/content
GET /api/kb/documents/:id/assets
GET /api/kb/documents/:id/permissions
GET /api/kb/changes?since=...
POST /api/kb/index-status
POST /api/kb/permission-check
```

KB Engine 提供：

```text
POST /kb/index
POST /kb/reindex
POST /kb/search
POST /kb/chat
GET /kb/status/:knowledgeBaseId
GET /kb/sessions/:id
GET /kb/logs
```

### 7.3 权限原则

企业端权限以文览为准。

问答流程：

```text
用户提问
-> 文览校验用户身份
-> 文览生成短期 scope token
-> KB Engine 根据 token 限定可检索范围
-> KB Engine 返回带引用答案
-> 文览展示答案和来源
```

不得让 KB Engine 绕过文览权限直接暴露知识。

## 8. 功能规划

### 8.0 Demo：最小可演示知识库问答闭环

目标：

尽快做出可演示的知识库问答能力。第一版不追求完整平台化，不做 Obsidian 插件、桌面端、GraphRAG、行业模板和复杂 Agent。

一句话目标：

```text
选一个文览文件夹作为知识库，上传几篇文档，用户可以提问，AI 只基于这些文档回答，并带引用来源。
```

演示对象：

- 企业：每个文件夹可以成为一个部门/项目/产品/行业知识库。
- 个人：未来同一引擎可以接 Obsidian Vault 或本地文件夹。

Demo 范围：

- 当前已落地的第一阶段 Demo 采用“无持久索引快跑方案”：先复用文览公开路由读取文件夹/文档内容，服务端内存切块与关键词检索，回答返回引用来源；后续再升级到下方完整表结构、pgvector 和后台索引任务。
- 后台文件夹支持“开启知识库”。
- 文档支持进入索引。
- 文件夹页提供“知识库问答”入口，进入独立对话页。
- 文档页提供“知识库问答”入口，进入独立对话页。
- 独立对话页 `/kb` 承载问答工作台，避免把阅读和对话混在同一个页面。
- `/kb` 页面采用轻量全屏对话工作台：顶部仅保留返回入口，回答区域居中阅读，输入框悬浮在底部，引用来源以“相关知识库”卡片跟随对应回答展示。
- 正式演示必须接入 AI 模型生成回答。RAG、切块、关键词/向量检索、重排和引用只是基础设施；面向用户的客服回答必须由模型基于检索依据生成。
- 无模型 Key 时不应伪装成正式问答；只能在本地开发通过 `KB_ALLOW_EXTRACTIVE_FALLBACK=true` 启用抽取式兜底。
- 回答必须显示引用来源。
- 找不到依据时明确回答“当前知识库中没有找到可靠依据”。
- 后台展示索引状态：未索引、索引中、已完成、失败。

Demo 暂不做：

- Obsidian 插件
- 桌面端
- Neo4j
- GraphRAG
- GBrain
- 多行业规则包
- 复杂 Agentic Search
- 外部客服系统接入

Demo 技术栈：

```text
第一阶段 Demo（已实现）：
文览现有 Next.js
文览公开路由权限校验
服务端 HTML 转文本
内存段落切块
关键词/中文字符检索
OpenAI-compatible Chat API（可选）
无模型 Key 时的抽取式回答兜底
引用来源

第二阶段正式版：
文览现有 Next.js + Supabase/PostgreSQL
PostgreSQL FTS
pgvector
简单文档切块
模型网关
Embedding
RAG Chat API
引用来源
```

Demo 数据表优先级：

```text
第一阶段 Demo：暂不新增数据表。

第二阶段正式版：
knowledge_base_configs
document_chunks
embedding_records
index_jobs
chat_sessions
chat_messages
```

Demo 问答链路：

```text
第一阶段 Demo：
用户提问
-> 确定 folder routePath / document routePath
-> 通过文览公开路由读取可访问内容
-> HTML 转文本并按段落切块
-> 关键词/中文字符检索
-> 有模型 Key 时由模型基于 chunks 回答
-> 无模型 Key 时抽取原文片段回答
-> 返回 citations

第二阶段正式版：
用户提问
-> 确定 folder_id / document_id 范围
-> 校验文览权限
-> 混合检索：关键词 + 向量
-> 取回 chunks
-> LLM 基于 chunks 回答
-> 返回 citations
-> 保存问答日志
```

Demo 精准度要求：

- 优先使用少量高质量文档演示。
- 切块按标题、段落、列表结构进行，不按固定字符数粗暴切。
- 检索必须混合关键词和向量，避免只靠语义相似度。
- Prompt 必须禁止编造。
- 没有检索依据时必须拒答。
- 每条回答必须带文览文档来源。
- 引用至少包含文档标题、路由、chunk 标题或段落摘要。

Demo 验收标准：

- 第一阶段 Demo：用户可以在文件夹页提问。
- 第一阶段 Demo：用户可以在文档页提问。
- 第一阶段 Demo：回答能引用文览中的原始文档。
- 第一阶段 Demo：对文档中不存在的问题，系统不会编造答案。
- 第二阶段正式版：管理员可以为一个文件夹开启知识库。
- 第二阶段正式版：管理员可以触发或自动完成索引构建。
- 第二阶段正式版：索引失败时后台能看到错误状态。

### 8.1 V1 保持不变：文档展台

沿用原 `Prd.md`。

目标：

- 展示
- 上传
- 权限
- 安全
- 基础搜索

不强行加入 RAG。

### 8.2 V1.5：知识库化

新增目标：

- 文件夹可以开启知识库模式。
- 文档可以进入索引。
- 用户可以按文件夹问答。

核心功能：

- 知识库配置面板
- 文件夹级问答入口
- 文档级问答入口
- 索引状态
- 文档切块
- PostgreSQL FTS
- pgvector
- 混合检索
- 引用来源
- 问答日志
- AI 标签/摘要/FAQ 建议

后台字段：

```text
aiEnabled
retrievalMode
systemPrompt
industryType
riskPolicy
indexStatus
lastIndexedAt
```

### 8.3 V2：智能知识生产闭环

新增目标：

- 多来源导入。
- LLM Wiki 式知识沉淀。
- AI 产物可审核、可发布、可回滚。

核心功能：

- PDF/Word/PPT/Excel/网页/飞书导入
- 标准化中间结构
- AI 摘要
- AI FAQ
- AI 实体卡片
- AI SOP 重组
- 人工审核
- 版本历史
- 知识沉淀为 Markdown/Wiki
- 高价值问答一键转文档

### 8.4 V2.5：个人本地知识库与行业增强

新增目标：

- 支持 Obsidian 个人知识库。
- 支持桌面端本地知识库。
- 支持行业模板和 GraphRAG。

核心功能：

- Obsidian 插件 Alpha
- Vault 扫描
- 双链/标签/frontmatter 解析
- 本地问答
- 本地高频问答沉淀
- Tauri Desktop Alpha
- 本地模型 Ollama 接入
- 医药行业模板
- 法律/保险/制造模板
- Neo4j/LightRAG/KAG 实验接入
- 风险问题识别与人工接管

### 8.5 V3：平台化与商业化

新增目标：

- 形成多入口、多行业、多部署形态的平台。

核心功能：

- 多租户
- API Token
- Webhook
- 外部客服系统接入
- 企业微信/飞书/钉钉接入
- 知识库模板市场
- Skill 市场
- 行业规则包
- 私有化部署包
- 桌面端 Pro
- 团队版配额
- AI 调用额度
- 审计报表

## 9. 数据契约增量

### 9.1 KnowledgeBaseConfig

```text
id
sourceType
sourceId
folderId
displayName
description
enabled
retrievalMode
industryType
riskPolicy
systemPrompt
modelProvider
chatModel
embeddingModel
vectorCollection
graphNamespace
indexStatus
lastIndexedAt
createdBy
createdAt
updatedAt
```

### 9.2 DocumentChunk

```text
id
knowledgeBaseId
documentId
sourceType
sourcePath
routePath
title
headingPath
content
contentHash
tokenCount
metadata
visibilitySnapshot
createdAt
updatedAt
```

### 9.3 EmbeddingRecord

```text
id
chunkId
knowledgeBaseId
provider
model
vector
dimension
contentHash
createdAt
```

### 9.4 IndexJob

```text
id
knowledgeBaseId
targetType
targetId
jobType
status
errorMessage
startedAt
finishedAt
createdAt
```

### 9.5 ChatSession

```text
id
knowledgeBaseId
scopeType
scopeId
userId
title
createdAt
updatedAt
```

### 9.6 ChatMessage

```text
id
sessionId
role
content
citations
retrievalPayload
riskFlags
model
createdAt
```

### 9.7 KnowledgeArtifact

```text
id
knowledgeBaseId
sourceType
sourceIds
artifactType
title
content
status
reviewedBy
publishedDocumentId
createdAt
updatedAt
```

### 9.8 GraphEntity

```text
id
knowledgeBaseId
entityType
name
aliases
description
sourceDocumentIds
confidence
createdAt
updatedAt
```

### 9.9 GraphRelation

```text
id
knowledgeBaseId
sourceEntityId
targetEntityId
relationType
evidenceChunkIds
confidence
createdAt
updatedAt
```

## 10. 安全与合规规则

### 10.1 权限安全

- 所有企业端问答必须继承文览权限。
- 检索结果不得包含用户无权访问的 chunk。
- 问答日志也要按权限隔离。
- 分享可见内容不能进入公开搜索，除非明确允许。

### 10.2 AI 安全

- AI 回答必须带来源。
- 找不到来源时必须说明无法确认。
- 低置信度回答需要提示用户。
- 高风险行业必须启用风险策略。
- 用户修正结果应进入待审核知识沉淀流程。

### 10.3 医药行业规则

医药模板中：

- 不做诊断。
- 不替代医生/药师。
- 不擅自推荐处方药。
- 不承诺疗效。
- 不回答超说明书用药建议。
- 孕妇、儿童、老人、慢病合并用药等问题默认提示咨询医生/药师。
- 严重不良反应、急症风险必须转人工或提示就医。

### 10.4 本地知识库规则

- Obsidian/桌面端默认本地处理。
- 用户明确授权后才同步到文览。
- 本地索引和本地问答记录可清除。
- 本地模型优先支持 Ollama。

## 11. 部署形态

### 11.1 SaaS / 公网版

适合：

- 公开知识库
- 个人展示
- 小团队
- 内容营销

### 11.2 企业私有化 Web

适合：

- 企业内部知识库
- 多人协作
- 权限审计
- 客服知识库

部署：

```text
web
kb-api
kb-worker
postgres + pgvector
minio
redis
optional neo4j
```

### 11.3 桌面端本地版

适合：

- 个人知识库
- 离线资料
- 敏感文档
- 不愿部署服务器的小团队

部署：

```text
Tauri
SQLite/DuckDB
LanceDB/Qdrant local
Ollama
local file storage
```

### 11.4 Obsidian 插件

适合：

- 已经使用 Obsidian 的个人用户
- Markdown 双链知识库
- 个人长期知识沉淀

## 12. 与豆包对话技术的对应关系

| 技术 | 在本体系中的位置 | 是否核心 |
|---|---|---|
| Obsidian | 个人知识库入口、Markdown/Vault 知识源 | 是，个人端核心 |
| LLM Wiki | 知识沉淀方法，把资料编译成 Wiki 页面 | 是，V2 核心思想 |
| GBrain | Agent 长期记忆、后台运营助手参考 | 可选增强 |
| Graph RAG | 行业复杂关系推理 | 行业增强核心 |
| 向量 RAG | 默认知识问答主链路 | 是，V1.5 核心 |
| Agentic Search | 精确原文查询、复杂问题补充检索 | 推荐增强 |
| AnythingLLM | 快速 Demo 和产品参考 | 参考，不绑定 |
| RAGFlow | 文档解析和 RAG 流程参考 | 参考，可局部借鉴 |
| Dify/FastGPT | 工作流/客服编排参考 | 可集成，不作为核心数据源 |
| Neo4j | GraphRAG 图存储 | 行业增强 |
| Milvus/Qdrant | 独立向量库 | 规模化后增强 |
| pgvector | 起步阶段向量存储 | 是，V1.5 推荐 |

## 13. 风险与取舍

### 13.1 不要过早全量 GraphRAG

GraphRAG 成本高、维护复杂，应先在医药、法律、保险等强关系知识库中启用。

### 13.2 不要把文览写成 AI 巨石应用

文览应作为知识资产平台，KB Engine 应通过接口解耦。

### 13.3 不要把 Obsidian 入口做成文览替代品

Obsidian 是个人入口，文览是企业入口。二者共用知识库引擎。

### 13.4 不要强依赖第三方 RAG 产品

AnythingLLM、RAGFlow、Dify、FastGPT 都适合参考或集成，但文览的数据主权、权限主权和引用主权应保留在自己体系中。

## 14. 推荐实施顺序

### 14.0 Demo 优先实施顺序

为了尽快对外演示，优先级高于完整 V1.5/V2 规划。

1. 保留现有文览页面和后台，不重构原 V1 能力。
2. 增加 `knowledge_base_configs`，让一个文览文件夹可以开启知识库。
3. 增加 `document_chunks`，从已有文档正文提取纯文本并切块。
4. 增加 `embedding_records`，用 pgvector 保存向量。
5. 增加 `index_jobs`，展示索引状态。
6. 增加搜索 API，支持按文件夹范围检索 chunks。
7. 增加问答 API，完成检索、生成、引用返回。
8. 在文件夹页加入“问这个知识库”组件。
9. 在文档页加入“问这篇文档”组件。
10. 增加后台索引状态和重建索引按钮。
11. 准备 5-20 篇高质量演示文档，优先保证演示准确度。

### 14.1 近期

1. 保留原文览 V1。
2. 新增知识库配置概念。
3. 让文件夹支持 `开启知识库`。
4. 增加文档切块表。
5. 增加 Postgres FTS + pgvector。
6. 增加文件夹级问答 API。
7. 回答支持引用文览文档。

### 14.2 中期

1. 拆出 kb-worker。
2. 接入 Docling/MinerU。
3. 支持 PDF/Word/PPT/Excel。
4. 增加 LLM Wiki 式知识沉淀。
5. 增加问答转 FAQ/文档。
6. 增加 AI 审核流程。

### 14.3 后期

1. 拆出 kb-api。
2. 支持 Obsidian 插件。
3. 支持 Tauri 桌面端。
4. 支持行业模板。
5. 支持 GraphRAG。
6. 支持私有化部署包。
7. 支持 API/SDK 和外部客服入口。

## 15. 最终确认

新的完整产品体系为：

```text
文览 = 企业知识资产平台
知识库引擎 = 智能检索与问答核心
Obsidian Connector = 个人知识库入口
Desktop = 本地私有知识库入口
GraphRAG/行业模板 = 高价值行业增强
```

原 `Prd.md` 保留，继续描述文览文档展示平台。

本文档作为新的智能知识库体系 PRD，用于指导后续“文览 + 知识库引擎 + Obsidian + 桌面端 + 行业模板”的完整规划。
