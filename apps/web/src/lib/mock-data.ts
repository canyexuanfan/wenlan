import { accessLabelMap } from "@/lib/content/constants";
import type {
  AccessMode,
  DocumentRecord,
  FolderRecord,
  OutlineItem,
  SiteSettings,
  ViewMode,
} from "@/lib/content/types";
import { buildRoutePath, formatDate, normalizeRoutePath, toHref } from "@/lib/content/utils";

export type {
  AccessMode,
  DocumentRecord,
  FolderRecord,
  OutlineItem,
  SiteSettings,
  ViewMode,
};

export { accessLabelMap, formatDate, toHref };

export const defaultSiteSettings: SiteSettings = {
  name: "文览",
  subtitle: "在线内容库",
  heroDescription: "SOP、指南、案例与报告，统一整理、在线阅读。",
  contactLabel: "联系我们",
  contactUrl: "https://www.hnwen17.top",
  seedMessage: "上传内容后，首页会自动展示精选与最新文档。",
};

export const siteSettings = defaultSiteSettings;

function createOutline(items: Array<[string, string]>): OutlineItem[] {
  return items.map(([id, label]) => ({ id, label }));
}

export const folders: FolderRecord[] = [
  {
    id: "folder-sop",
    parentId: null,
    name: "SOP 文档库",
    slug: "sop",
    routePath: "sop",
    description: "沉淀流程、模板、动作卡与执行清单的核心文档区。",
    heroNote: "适合放 SOP、操作模板和步骤式知识。",
    accessMode: "public",
    order: 1,
    accent: "clay",
  },
  {
    id: "folder-guides",
    parentId: null,
    name: "指南与手册",
    slug: "guides",
    routePath: "guides",
    description: "容纳规范、手册、产品说明与长期维护类文档。",
    heroNote: "更适合持续更新、适合反复查阅的知识内容。",
    accessMode: "public",
    order: 2,
    accent: "sage",
  },
  {
    id: "folder-reports",
    parentId: null,
    name: "报告与案例",
    slug: "reports",
    routePath: "reports",
    description: "收纳阶段复盘、项目案例、报告快照与内部沉淀。",
    heroNote: "适合有上下文、有时效、有结论的内容。",
    accessMode: "public",
    order: 3,
    accent: "sky",
  },
  {
    id: "folder-operations",
    parentId: "folder-sop",
    name: "运营文档",
    slug: "operations",
    routePath: "sop/operations",
    description: "放选题、标题、分发、复盘等运营类 SOP。",
    heroNote: "当前目录偏向内容运营与增长动作。",
    accessMode: "public",
    order: 1,
    accent: "clay",
  },
  {
    id: "folder-writing",
    parentId: "folder-sop",
    name: "写作模板",
    slug: "writing",
    routePath: "sop/writing",
    description: "整理结构模板、表达技巧与常用排版策略。",
    heroNote: "适合方法卡、模板卡与可复用框架。",
    accessMode: "public",
    order: 2,
    accent: "rose",
  },
  {
    id: "folder-accessibility",
    parentId: "folder-guides",
    name: "无障碍检查",
    slug: "accessibility",
    routePath: "guides/accessibility",
    description: "沉淀键盘操作、焦点样式、语义结构与对比度规范。",
    heroNote: "这类内容适合长期维护，也适合列表视图检索。",
    accessMode: "public",
    order: 1,
    accent: "sage",
  },
];

export const documents: DocumentRecord[] = [
  {
    id: "doc-opening-hooks",
    folderId: "folder-operations",
    title: "爆款开头库",
    slug: "opening-hooks",
    routePath: "sop/operations/opening-hooks",
    summary: "把高频可复用的开头打法整理成可直接套用的结构卡片。",
    tags: ["SOP", "运营", "写作"],
    accessMode: "public",
    authorName: "十七",
    updatedAt: "2026-04-16",
    readingTime: "8 分钟",
    featured: true,
    outline: createOutline([
      ["task", "开头的任务"],
      ["mistakes", "常见错误"],
      ["patterns", "三种结构"],
      ["examples", "示例拆解"],
    ]),
    relatedIds: ["doc-title-playbook", "doc-accessibility-review"],
    renderMode: "site",
    bodyHtml: `
      <section id="task">
        <h2>开头的任务</h2>
        <p>一篇文档的开头不是寒暄区，而是帮助读者判断“这篇内容值不值得继续读”。如果第一屏没有说清楚问题、收益和适用场景，后面的内容再扎实也容易被跳过。</p>
        <div class="doc-highlight">先交代这份文档解决什么问题，再说明为什么现在值得读。</div>
      </section>
      <section id="mistakes">
        <h2>常见错误</h2>
        <div class="sticky-note">
          <strong>错误示例：</strong>
          <p>“大家好，今天我来聊一聊……” 这种开头没有问题感，也没有收益感，读者没有继续投入的理由。</p>
        </div>
        <ul class="doc-checklist">
          <li>不要把背景铺垫写得比价值本身还长。</li>
          <li>不要在第一屏使用空泛的行业大词。</li>
          <li>不要先解释自己，再解释用户为什么要继续读。</li>
        </ul>
      </section>
      <section id="patterns">
        <h2>三种结构</h2>
        <div class="doc-grid">
          <article>
            <h3>问题先行</h3>
            <p>直接点出用户正在经历的卡点，再给出这份文档会带来的变化。</p>
          </article>
          <article>
            <h3>结果先行</h3>
            <p>先展示“读完以后能得到什么”，再补充方法路径。</p>
          </article>
          <article>
            <h3>对比先行</h3>
            <p>用旧做法和新做法的反差，让文档的必要性迅速成立。</p>
          </article>
        </div>
      </section>
      <section id="examples">
        <h2>示例拆解</h2>
        <div class="doc-versus">
          <div>
            <span>旧写法</span>
            <p>今天分享一下我最近的一些想法。</p>
          </div>
          <div>
            <span>新写法</span>
            <p>如果你写了 20 篇内容还没有稳定开头模板，这份文档会帮你把返工时间至少砍半。</p>
          </div>
        </div>
      </section>
    `,
  },
  {
    id: "doc-title-playbook",
    folderId: "folder-operations",
    title: "标题打法手册",
    slug: "title-playbook",
    routePath: "sop/operations/title-playbook",
    summary: "把标题从灵感问题变成可拆解、可复用、可复盘的机制。",
    tags: ["SOP", "标题", "运营"],
    accessMode: "public",
    authorName: "十七",
    updatedAt: "2026-04-15",
    readingTime: "11 分钟",
    featured: true,
    outline: createOutline([
      ["why", "为什么标题要模块化"],
      ["formula", "高频公式"],
      ["test", "复盘方式"],
    ]),
    relatedIds: ["doc-opening-hooks", "doc-wechat-layout"],
    renderMode: "site",
    bodyHtml: `
      <section id="why">
        <h2>为什么标题要模块化</h2>
        <p>标题不是一句灵感闪光，而是由对象、利益、冲突、时间和差异化共同组成的组合体。模块化以后，标题才能持续产出，而不是一时灵感。</p>
        <div class="doc-quote">先让标题可复盘，再追求标题惊艳。</div>
      </section>
      <section id="formula">
        <h2>高频公式</h2>
        <ol class="doc-timeline">
          <li><strong>对象 + 收益：</strong>给谁看，看完能得到什么。</li>
          <li><strong>冲突 + 结果：</strong>读者的卡点是什么，被解决后状态会怎样。</li>
          <li><strong>时间 + 成本：</strong>多久见效，能省掉什么。</li>
        </ol>
        <div class="sticky-note soft">
          <strong>提醒：</strong>
          <p>如果文档本身偏专业，标题应该更克制，避免写成营销文案。</p>
        </div>
      </section>
      <section id="test">
        <h2>复盘方式</h2>
        <ul class="doc-checklist">
          <li>把高点击标题拆成结构，而不是背下一整句。</li>
          <li>低点击标题也要记录失效原因。</li>
          <li>建立自己的标题素材库与禁用词库。</li>
        </ul>
      </section>
    `,
  },
  {
    id: "doc-wechat-layout",
    folderId: "folder-writing",
    title: "公众号版式清单",
    slug: "wechat-layout",
    routePath: "sop/writing/wechat-layout",
    summary: "从结构、图片、强调到手机阅读密度，整理公众号版式的最低可用标准。",
    tags: ["写作", "排版", "公众号"],
    accessMode: "public",
    authorName: "十七",
    updatedAt: "2026-04-14",
    readingTime: "10 分钟",
    featured: true,
    outline: createOutline([
      ["density", "阅读密度"],
      ["emphasis", "强调方式"],
      ["assets", "图片与组件"],
    ]),
    relatedIds: ["doc-title-playbook", "doc-opening-hooks"],
    renderMode: "site",
    bodyHtml: `
      <section id="density">
        <h2>阅读密度</h2>
        <p>手机上最难受的不是字多，而是每一段都像一堵墙。段落越长，越需要节奏点和停顿点。</p>
        <div class="doc-highlight">一屏至少给读者一个视觉落点：小标题、便签、列表或对比块。</div>
      </section>
      <section id="emphasis">
        <h2>强调方式</h2>
        <div class="doc-grid">
          <article>
            <h3>荧光块</h3>
            <p>用于命中观点，不用于整段上色。</p>
          </article>
          <article>
            <h3>便签纸</h3>
            <p>适合放提醒、坑点与经验话。</p>
          </article>
          <article>
            <h3>对比块</h3>
            <p>适合说明旧方案和新方案的区别。</p>
          </article>
        </div>
      </section>
      <section id="assets">
        <h2>图片与组件</h2>
        <ul class="doc-checklist">
          <li>插图必须服务信息，不只是装饰。</li>
          <li>横图要考虑手机裁切和缩放。</li>
          <li>代码块或表格必须检查窄屏可读性。</li>
        </ul>
      </section>
    `,
  },
  {
    id: "doc-accessibility-review",
    folderId: "folder-accessibility",
    title: "无障碍检查清单",
    slug: "keyboard-review",
    routePath: "guides/accessibility/keyboard-review",
    summary: "把键盘可操作、焦点样式、语义结构和对比度要求整理成一页可执行检查表。",
    tags: ["指南", "无障碍", "检查"],
    accessMode: "public",
    authorName: "十七",
    updatedAt: "2026-04-16",
    readingTime: "7 分钟",
    outline: createOutline([
      ["keyboard", "键盘路径"],
      ["focus", "焦点反馈"],
      ["semantics", "语义结构"],
    ]),
    relatedIds: ["doc-opening-hooks", "doc-quarterly-snapshot"],
    renderMode: "site",
    bodyHtml: `
      <section id="keyboard">
        <h2>键盘路径</h2>
        <p>所有核心交互都必须能够通过键盘完成，尤其是菜单、弹层、切换器和上传操作。</p>
        <div class="doc-highlight">右键菜单不是唯一入口，必须给“更多操作”按钮。</div>
      </section>
      <section id="focus">
        <h2>焦点反馈</h2>
        <ul class="doc-checklist">
          <li>焦点样式必须清晰可见。</li>
          <li>不要仅依赖颜色传达状态。</li>
          <li>弹层打开后，焦点要进入弹层内部。</li>
        </ul>
      </section>
      <section id="semantics">
        <h2>语义结构</h2>
        <div class="sticky-note mint">
          <strong>最低要求：</strong>
          <p>导航用 nav，主内容用 main，标题层级不能跳，按钮和链接不能混用。</p>
        </div>
      </section>
    `,
  },
  {
    id: "doc-quarterly-snapshot",
    folderId: "folder-reports",
    title: "季度内容复盘速览",
    slug: "quarterly-snapshot",
    routePath: "reports/quarterly-snapshot",
    summary: "适合放阶段复盘、观察笔记和高层次策略快照。",
    tags: ["报告", "复盘", "案例"],
    accessMode: "public",
    authorName: "十七",
    updatedAt: "2026-04-13",
    readingTime: "6 分钟",
    outline: createOutline([
      ["signal", "本季信号"],
      ["mistake", "踩过的坑"],
      ["next", "下季动作"],
    ]),
    relatedIds: ["doc-title-playbook"],
    renderMode: "site",
    bodyHtml: `
      <section id="signal">
        <h2>本季信号</h2>
        <p>最明显的变化不是内容变多，而是用户只会为结构清晰、交付明确的内容停留。</p>
      </section>
      <section id="mistake">
        <h2>踩过的坑</h2>
        <div class="doc-versus">
          <div>
            <span>错误动作</span>
            <p>收集了很多资料，但没有统一展示壳层与阅读路径。</p>
          </div>
          <div>
            <span>正确动作</span>
            <p>先统一阅读体验，再逐步增加导入、AI 和 CLI 能力。</p>
          </div>
        </div>
      </section>
      <section id="next">
        <h2>下季动作</h2>
        <ol class="doc-timeline">
          <li>上线文档展台基础版本。</li>
          <li>补齐权限与上传链路。</li>
          <li>验证公众号转换场景的价值。</li>
        </ol>
      </section>
    `,
  },
  {
    id: "doc-client-war-room",
    folderId: "folder-reports",
    title: "客户战情室",
    slug: "client-war-room",
    routePath: "reports/client-war-room",
    summary: "仅内部查看的客户项目复盘与决策记录。",
    tags: ["案例", "内部", "私有"],
    accessMode: "private",
    authorName: "十七",
    updatedAt: "2026-04-12",
    readingTime: "5 分钟",
    outline: createOutline([
      ["summary", "项目摘要"],
      ["risk", "风险记录"],
    ]),
    relatedIds: [],
    renderMode: "site",
    bodyHtml: `
      <section id="summary">
        <h2>项目摘要</h2>
        <p>这是一篇私密案例，用于后台预览与权限演示。</p>
      </section>
      <section id="risk">
        <h2>风险记录</h2>
        <p>当前仅管理员可见，不允许在公共路由中暴露。</p>
      </section>
    `,
  },
];

const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
const folderRouteMap = new Map(folders.map((folder) => [folder.routePath, folder]));
const documentMap = new Map(documents.map((document) => [document.id, document]));
const documentRouteMap = new Map(documents.map((document) => [document.routePath, document]));

function byOrder<T extends { order?: number; updatedAt?: string }>(left: T, right: T) {
  if (typeof left.order === "number" && typeof right.order === "number") {
    return left.order - right.order;
  }

  if (left.updatedAt && right.updatedAt) {
    return right.updatedAt.localeCompare(left.updatedAt);
  }

  return 0;
}

export function getTopLevelFolders() {
  return folders.filter((folder) => folder.parentId === null).sort(byOrder);
}

export function getFoldersByParent(parentId: string | null) {
  return folders.filter((folder) => folder.parentId === parentId).sort(byOrder);
}

export function getFolderById(folderId: string) {
  return folderMap.get(folderId);
}

export function getFolderByRoutePath(routePath: string) {
  return folderRouteMap.get(normalizeRoutePath(routePath));
}

export function getDocumentById(documentId: string) {
  return documentMap.get(documentId);
}

export function getDocumentByRoutePath(routePath: string) {
  return documentRouteMap.get(normalizeRoutePath(routePath));
}

export function getFolderTrail(folderId: string) {
  const trail: FolderRecord[] = [];
  let current = folderMap.get(folderId);

  while (current) {
    trail.unshift(current);
    current = current.parentId ? folderMap.get(current.parentId) : undefined;
  }

  return trail;
}

export function getDocumentTrail(documentId: string) {
  const document = documentMap.get(documentId);

  if (!document) {
    return [];
  }

  return [
    ...(document.folderId ? getFolderTrail(document.folderId) : []),
    document,
  ];
}

export function buildFolderSegments(folderId: string) {
  const folder = folderMap.get(folderId);

  return folder ? folder.routePath.split("/") : [];
}

export function buildFolderHref(folderIdOrRoutePath: string) {
  const folder = folderMap.get(folderIdOrRoutePath) ?? getFolderByRoutePath(folderIdOrRoutePath);

  return toHref(folder?.routePath ?? normalizeRoutePath(folderIdOrRoutePath));
}

export function buildDocumentHref(documentIdOrRoutePath: string) {
  const document =
    documentMap.get(documentIdOrRoutePath) ??
    getDocumentByRoutePath(documentIdOrRoutePath);

  return toHref(document?.routePath ?? normalizeRoutePath(documentIdOrRoutePath));
}

export function getFolderChildren(folderId: string) {
  const childFolders = getFoldersByParent(folderId);
  const childDocuments = documents
    .filter((document) => document.folderId === folderId)
    .sort(byOrder);

  return {
    childFolders,
    childDocuments,
  };
}

export function getPublicFolderChildren(folderId: string) {
  const { childFolders, childDocuments } = getFolderChildren(folderId);

  return {
    childFolders: childFolders.filter((folder) => folder.accessMode === "public"),
    childDocuments: childDocuments.filter((document) => document.accessMode === "public"),
  };
}

export function getFeaturedDocuments() {
  return documents.filter(
    (document) => document.featured && document.accessMode === "public",
  );
}

export function getLatestPublicDocuments(limit = 4) {
  return documents
    .filter((document) => document.accessMode === "public")
    .sort(byOrder)
    .slice(0, limit);
}

export function getRelatedDocuments(documentId: string) {
  const document = documentMap.get(documentId);

  if (!document) {
    return [];
  }

  return document.relatedIds
    .map((relatedId) => documentMap.get(relatedId))
    .filter((related): related is DocumentRecord => related !== undefined)
    .filter((related) => related.accessMode === "public");
}

export function resolveFolderByPath(slugs: string[]) {
  return getFolderByRoutePath(buildRoutePath(slugs));
}

export function resolvePublicRoute(slugs: string[]) {
  const routePath = buildRoutePath(slugs);
  const folder = getFolderByRoutePath(routePath);

  if (folder && folder.accessMode === "public") {
    return {
      kind: "folder" as const,
      folder,
    };
  }

  const document = getDocumentByRoutePath(routePath);

  if (document && document.accessMode === "public") {
    return {
      kind: "document" as const,
      document,
    };
  }

  return null;
}

export function getAllPublicPaths() {
  const folderPaths = folders
    .filter((folder) => folder.accessMode === "public")
    .map((folder) => folder.routePath.split("/"));

  const documentPaths = documents
    .filter((document) => document.accessMode === "public")
    .map((document) => document.routePath.split("/"));

  return [...folderPaths, ...documentPaths];
}
