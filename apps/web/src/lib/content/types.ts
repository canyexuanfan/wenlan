export type AccessMode =
  | "public"
  | "login"
  | "private"
  | "specific_users"
  | "group";
export type ViewMode = "card" | "list";
export type AccentTone = "clay" | "sage" | "sky" | "rose";
export type DocumentRenderMode = "site" | "source";
export type HomeSearchFilters = {
  query: string;
  tag: string;
};

export type SiteSettings = {
  name: string;
  subtitle: string;
  heroDescription: string;
  contactLabel: string;
  contactUrl: string;
  seedMessage: string;
};

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type OutlineItem = {
  id: string;
  label: string;
  level?: number;
};

export type FolderRecord = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  routePath: string;
  description: string;
  heroNote: string;
  accessMode: AccessMode;
  order: number;
  accent: AccentTone;
};

export type DocumentRecord = {
  id: string;
  folderId: string;
  title: string;
  slug: string;
  routePath: string;
  summary: string;
  tags: string[];
  accessMode: AccessMode;
  authorName: string;
  updatedAt: string;
  readingTime: string;
  featured?: boolean;
  renderMode: DocumentRenderMode;
  bodyHtml: string;
  outline: OutlineItem[];
  relatedIds: string[];
};

export type HomePageData = {
  siteSettings: SiteSettings;
  filters: HomeSearchFilters;
  navigationFolders: FolderRecord[];
  availableTags: string[];
  searchFolders: FolderRecord[];
  searchDocuments: DocumentRecord[];
  featuredDocuments: DocumentRecord[];
  topLevelFolders: FolderRecord[];
  latestDocuments: DocumentRecord[];
};

export type FolderPageData = {
  siteSettings: SiteSettings;
  navigationFolders: FolderRecord[];
  folder: FolderRecord;
  breadcrumbs: BreadcrumbItem[];
  childFolders: FolderRecord[];
  childDocuments: DocumentRecord[];
};

export type DocumentPageData = {
  siteSettings: SiteSettings;
  navigationFolders: FolderRecord[];
  folder: FolderRecord;
  document: DocumentRecord;
  breadcrumbs: BreadcrumbItem[];
  relatedDocuments: DocumentRecord[];
};

export type PublicRouteData =
  | {
      kind: "folder";
      data: FolderPageData;
    }
  | {
      kind: "document";
      data: DocumentPageData;
    }
  | {
      kind: "login-required";
      redirectTo: string;
      title: string;
    };
