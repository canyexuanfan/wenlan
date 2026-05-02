import type { Metadata } from "next";

import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { SiteFrame } from "@/components/public/site-frame";
import { requireAdminPage } from "@/lib/auth/server";
import { getAdminWorkspaceData } from "@/lib/admin/repository";

export const metadata: Metadata = {
  title: "后台工作台",
  description: "文览后台资源管理台。",
};

export default async function AdminPage() {
  const viewer = await requireAdminPage("/admin");
  const workspace = await getAdminWorkspaceData("content");

  return (
    <SiteFrame hideAdminLink viewer={viewer}>
      <AdminWorkspace key="content-workspace" initialWorkspace={workspace} />
    </SiteFrame>
  );
}
