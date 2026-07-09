import { NextResponse } from "next/server";

import {
  addAccountFavorite,
  removeAccountFavorite,
} from "@/lib/account/repository";
import { assertAuthenticatedAccess } from "@/lib/auth/server";

type FavoritePayload = {
  targetId?: string;
  targetType?: "folder" | "document";
};

function isTargetType(value: string): value is "folder" | "document" {
  return value === "folder" || value === "document";
}

async function parseFavoritePayload(request: Request) {
  const payload = (await request.json()) as FavoritePayload;
  const targetId = String(payload.targetId ?? "").trim();
  const targetType = String(payload.targetType ?? "").trim();

  if (!targetId || !isTargetType(targetType)) {
    return null;
  }

  return {
    targetId,
    targetType,
  };
}

export async function POST(request: Request) {
  try {
    const viewer = await assertAuthenticatedAccess();

    if (!viewer.profileId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const parsedPayload = await parseFavoritePayload(request);

    if (!parsedPayload) {
      return NextResponse.json({ error: "Invalid target." }, { status: 400 });
    }

    const snapshot = await addAccountFavorite(
      viewer.profileId,
      parsedPayload.targetType,
      parsedPayload.targetId,
    );

    if (!snapshot) {
      return NextResponse.json({ error: "Target not found." }, { status: 404 });
    }

    return NextResponse.json({
      favorited: true,
      routePath: snapshot.routePath,
      title: snapshot.title,
    });
  } catch {
    return NextResponse.json({ error: "Unable to save favorite." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const viewer = await assertAuthenticatedAccess();

    if (!viewer.profileId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const parsedPayload = await parseFavoritePayload(request);

    if (!parsedPayload) {
      return NextResponse.json({ error: "Invalid target." }, { status: 400 });
    }

    await removeAccountFavorite(
      viewer.profileId,
      parsedPayload.targetType,
      parsedPayload.targetId,
    );

    return NextResponse.json({ favorited: false });
  } catch {
    return NextResponse.json({ error: "Unable to remove favorite." }, { status: 500 });
  }
}
