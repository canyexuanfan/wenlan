import type { Metadata } from "next";

import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { SiteFrame } from "@/components/public/site-frame";
import { requireAdminPage } from "@/lib/auth/server";
import { getAdminWorkspaceData } from "@/lib/admin/repository";

export const metadata: Metadata = {
  title: "成员管理",
  description: "文览后台成员与邀请管理。",
};

export default async function AdminMembersPage() {
  const viewer = await requireAdminPage("/admin/members");
  const workspace = await getAdminWorkspaceData("members");

  return (
    <SiteFrame hideAdminLink viewer={viewer}>
      <AdminWorkspace key="members-workspace" mode="members" initialWorkspace={workspace} />
    </SiteFrame>
  );
}
