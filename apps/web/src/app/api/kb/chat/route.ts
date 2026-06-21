import { NextResponse } from "next/server";

import { getAuthViewer, viewerCanManageAdmin } from "@/lib/auth/server";
import {
  answerKnowledgeQuestion,
  KnowledgeModelError,
  type KnowledgeModelProvider,
  type KnowledgeScopeType,
} from "@/lib/kb/demo-rag";

type ChatRequestPayload = {
  scopeType?: KnowledgeScopeType;
  routePath?: string;
  question?: string;
  modelProvider?: KnowledgeModelProvider;
  modelId?: string;
  apiKey?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ChatRequestPayload;
    const scopeType = payload.scopeType;
    const routePath = payload.routePath?.trim() ?? "";
    const question = payload.question?.trim() ?? "";
    const viewer = await getAuthViewer();
    const allowServerApiKey = viewerCanManageAdmin(viewer.siteRole);

    if (scopeType !== "folder" && scopeType !== "document") {
      return NextResponse.json({ error: "Invalid knowledge scope." }, { status: 400 });
    }

    if (!routePath) {
      return NextResponse.json({ error: "Missing route path." }, { status: 400 });
    }

    if (!question) {
      return NextResponse.json({ error: "Missing question." }, { status: 400 });
    }

    const result = await answerKnowledgeQuestion({
      scopeType,
      routePath,
      question,
      modelProvider: payload.modelProvider,
      modelId: payload.modelId,
      userApiKey: payload.apiKey,
      allowServerApiKey,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof KnowledgeModelError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Knowledge chat failed.";
}
