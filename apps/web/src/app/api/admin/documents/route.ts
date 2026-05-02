import { NextResponse } from "next/server";

import {
  createAdminDocument,
  deleteAdminDocument,
  getAdminDocumentDetail,
  moveAdminDocument,
  reorderAdminDocument,
  updateAdminDocument,
} from "@/lib/admin/repository";
import { assertAdminAccess, isAuthAccessError } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  AdminDocumentRecord,
  CreateDocumentInput,
  DeleteDocumentInput,
  MoveDocumentInput,
  ReorderDocumentInput,
  UpdateDocumentInput,
} from "@/lib/admin/types";

const DOCUMENT_DETAIL_CACHE_TTL_MS = 30_000;
const documentDetailCache = new Map<
  string,
  { expiresAt: number; document: AdminDocumentRecord }
>();

function getCachedDocumentDetail(documentId: string) {
  const cached = documentDetailCache.get(documentId);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    documentDetailCache.delete(documentId);
    return null;
  }

  return cached.document;
}

function setCachedDocumentDetail(document: AdminDocumentRecord) {
  documentDetailCache.set(document.id, {
    expiresAt: Date.now() + DOCUMENT_DETAIL_CACHE_TTL_MS,
    document,
  });
}

function invalidateCachedDocumentDetail(documentId: string) {
  documentDetailCache.delete(documentId);
}

export async function GET(request: Request) {
  try {
    if (isSupabaseConfigured()) {
      await assertAdminAccess();
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("id") ?? "";

    if (!documentId) {
      return NextResponse.json({ error: "Missing document id." }, { status: 400 });
    }

    const cached = getCachedDocumentDetail(documentId);

    if (cached) {
      return NextResponse.json(cached);
    }

    const document = await getAdminDocumentDetail(documentId);
    setCachedDocumentDetail(document);
    return NextResponse.json(document);
  } catch (error) {
    if (isAuthAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: toErrorMessage(error) }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    if (isSupabaseConfigured()) {
      await assertAdminAccess();
    }

    const payload = (await request.json()) as CreateDocumentInput;
    const document = await createAdminDocument(payload);
    setCachedDocumentDetail(document);
    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    if (isAuthAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: toErrorMessage(error) }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (isSupabaseConfigured()) {
      await assertAdminAccess();
    }

    const payload = (await request.json()) as
      | (UpdateDocumentInput & { action?: undefined })
      | ({ action: "move" } & MoveDocumentInput)
      | ({ action: "reorder" } & ReorderDocumentInput);

    if (payload.action === "move") {
      const documentId = await moveAdminDocument(payload);
      invalidateCachedDocumentDetail(documentId);
      return NextResponse.json({ id: documentId });
    }

    if (payload.action === "reorder") {
      const documentId = await reorderAdminDocument(payload);
      return NextResponse.json({ id: documentId });
    }

    const document = await updateAdminDocument(payload);
    setCachedDocumentDetail(document);
    return NextResponse.json(document);
  } catch (error) {
    if (isAuthAccessError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: toErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (isSupabaseConfigured()) {
      await assertAdminAccess();
    }

    const payload = (await request.json()) as DeleteDocumentInput;
    const documentId = await deleteAdminDocument(payload);
    invalidateCachedDocumentDetail(documentId);
    return NextResponse.json({ id: documentId });
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

  return "未知文档接口错误。";
}
