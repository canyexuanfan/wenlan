import { NextResponse } from "next/server";

import { importAdminHtmlDocument } from "@/lib/admin/repository";
import { assertAdminAccess, isAuthAccessError } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function POST(request: Request) {
  try {
    if (isSupabaseConfigured()) {
      await assertAdminAccess();
    }

    const formData = await request.formData();
    const documentFile = formData.get("documentFile") ?? formData.get("htmlFile");

    if (!(documentFile instanceof File)) {
      return NextResponse.json(
        { error: "必须上传 HTML 或 Markdown 文件。" },
        { status: 400 },
      );
    }

    const assetFiles = formData
      .getAll("assets")
      .filter((entry): entry is File => entry instanceof File);
    const assetPaths = formData.getAll("assetPaths").map((entry) => String(entry));
    const rawFolderId = String(formData.get("folderId") ?? "").trim();
    const document = await importAdminHtmlDocument({
      folderId: rawFolderId || null,
      title: String(formData.get("title") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      tags: String(formData.get("tags") ?? ""),
      accessMode: String(formData.get("accessMode") ?? "inherit") as
        | "inherit"
        | "public"
        | "share"
        | "login"
        | "private"
        | "specific_users"
        | "group",
      renderMode: String(formData.get("renderMode") ?? "site") as "site" | "source",
      htmlFile: documentFile,
      assetFiles: assetFiles.map((file, index) => ({
        file,
        relativePath: assetPaths[index] || file.name,
      })),
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    if (isAuthAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: toErrorMessage(error) }, { status: 400 });
  }
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    return JSON.stringify(error);
  }

  return "未知文档导入错误。";
}
