import { NextResponse } from "next/server";

import { assertAuthenticatedAccess, isAuthAccessError } from "@/lib/auth/server";
import { uploadDocumentObject } from "@/lib/storage/document-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase 尚未配置，暂时无法上传头像。" }, { status: 400 });
    }

    const viewer = await assertAuthenticatedAccess();

    if (!viewer.profileId) {
      return NextResponse.json({ error: "当前登录用户缺少资料记录。" }, { status: 400 });
    }

    const formData = await request.formData();
    const avatarFile = formData.get("avatar");

    if (!(avatarFile instanceof File) || avatarFile.size <= 0) {
      return NextResponse.json({ error: "请选择一张头像图片。" }, { status: 400 });
    }

    if (!ALLOWED_CONTENT_TYPES.has(avatarFile.type)) {
      return NextResponse.json({ error: "头像只支持 JPG、PNG 或 WebP 图片。" }, { status: 400 });
    }

    if (avatarFile.size > MAX_AVATAR_SIZE_BYTES) {
      return NextResponse.json({ error: "头像图片不能超过 5MB。" }, { status: 400 });
    }

    const extension = resolveExtension(avatarFile);
    const uploadedAt = Date.now();
    const key = `avatars/${viewer.profileId}/current.${extension}`;
    const body = Buffer.from(await avatarFile.arrayBuffer());
    const adminClient = createSupabaseAdminClient();
    const uploaded = await uploadDocumentObject(adminClient, {
      key,
      body,
      contentType: avatarFile.type,
    });
    const avatarUrl = `${uploaded.publicUrl}?v=${uploadedAt}`;

    const { error } = await adminClient
      .schema("app")
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", viewer.profileId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ avatarUrl });
  } catch (error) {
    if (isAuthAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: toErrorMessage(error) }, { status: 400 });
  }
}

function resolveExtension(file: File) {
  switch (file.type) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    return JSON.stringify(error);
  }

  return "头像上传失败。";
}
