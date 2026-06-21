import "server-only";

import type { DocumentRecord } from "@/lib/content/types";
import { getPublicRouteData } from "@/lib/content/repository";
import { normalizeRoutePath, toHref } from "@/lib/content/utils";

export type KnowledgeScopeType = "folder" | "document";
export type KnowledgeModelProvider = "deepseek";
export type KnowledgeModelId = "deepseek-v4-flash" | "deepseek-v4-pro";

export type KnowledgeCitation = {
  id: string;
  title: string;
  href: string;
  snippet: string;
  score: number;
};

export type KnowledgeAnswer = {
  answer: string;
  citations: KnowledgeCitation[];
  mode: "model" | "extractive";
  model: {
    provider: KnowledgeModelProvider;
    id: KnowledgeModelId;
    credentialSource: "server" | "user";
  };
};

type KnowledgeChunk = {
  id: string;
  documentTitle: string;
  routePath: string;
  content: string;
};

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type ResolvedModelSettings = {
  apiKey: string;
  baseUrl: string;
  modelId: KnowledgeModelId;
  publicModel: KnowledgeAnswer["model"];
};

export class KnowledgeModelError extends Error {
  status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = "KnowledgeModelError";
    this.status = status;
  }
}

const MAX_QUESTION_LENGTH = 500;
const MAX_CHUNKS_FOR_ANSWER = 5;
const MAX_CONTEXT_CHARS = 6000;
const CHUNK_TARGET_CHARS = 900;
const CHUNK_MAX_CHARS = 1400;
const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_DEEPSEEK_MODEL: KnowledgeModelId = "deepseek-v4-flash";

export async function answerKnowledgeQuestion(input: {
  scopeType: KnowledgeScopeType;
  routePath: string;
  question: string;
  modelProvider?: KnowledgeModelProvider;
  modelId?: string;
  userApiKey?: string;
  allowServerApiKey: boolean;
}): Promise<KnowledgeAnswer> {
  const question = input.question.trim().slice(0, MAX_QUESTION_LENGTH);
  const routePath = normalizeRoutePath(input.routePath);
  const modelSettings = resolveModelSettings({
    allowServerApiKey: input.allowServerApiKey,
    modelId: input.modelId,
    modelProvider: input.modelProvider,
    userApiKey: input.userApiKey,
  });

  if (!question) {
    return {
      answer: "请先输入一个要询问的问题。",
      citations: [],
      mode: "extractive",
      model: modelSettings.publicModel,
    };
  }

  const documents = await loadScopeDocuments(input.scopeType, routePath);
  const chunks = documents.flatMap(chunkDocument);
  const rankedChunks = rankChunks(question, chunks).slice(0, MAX_CHUNKS_FOR_ANSWER);
  const citations = rankedChunks.map((chunk, index) => toCitation(chunk, index + 1));

  if (citations.length === 0) {
    return {
      answer: "当前知识库中没有找到可靠依据。请换一个更具体的问题，或先补充相关文档内容。",
      citations: [],
      mode: "extractive",
      model: modelSettings.publicModel,
    };
  }

  const modelAnswer = await generateModelAnswer(question, rankedChunks, modelSettings);

  return {
    answer: modelAnswer,
    citations,
    mode: "model",
    model: modelSettings.publicModel,
  };
}

async function loadScopeDocuments(scopeType: KnowledgeScopeType, routePath: string) {
  const routeData = await getPublicRouteData(routePathToSegments(routePath));

  if (!routeData || routeData.kind === "login-required") {
    return [];
  }

  if (scopeType === "document") {
    if (routeData.kind !== "document") {
      return [];
    }

    return [routeData.data.document];
  }

  if (routeData.kind !== "folder") {
    return [];
  }

  const documentResults = await Promise.all(
    routeData.data.childDocuments.map((document) =>
      getPublicRouteData(routePathToSegments(document.routePath)),
    ),
  );

  return documentResults.flatMap((result) => {
    if (!result || result.kind !== "document") {
      return [];
    }

    return [result.data.document];
  });
}

function chunkDocument(document: DocumentRecord): KnowledgeChunk[] {
  const bodyText = htmlToText(document.bodyHtml);
  const fullText = [document.title, document.summary, bodyText].filter(Boolean).join("\n\n");
  const paragraphs = fullText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks: KnowledgeChunk[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }

    const next = `${current}\n\n${paragraph}`;

    if (next.length <= CHUNK_TARGET_CHARS) {
      current = next;
      continue;
    }

    chunks.push(buildChunk(document, chunks.length, current));
    current = paragraph;
  }

  if (current) {
    chunks.push(buildChunk(document, chunks.length, current));
  }

  return chunks.flatMap((chunk) => splitLargeChunk(chunk));
}

function buildChunk(document: DocumentRecord, index: number, content: string): KnowledgeChunk {
  return {
    id: `${document.id}:${index}`,
    documentTitle: document.title,
    routePath: document.routePath,
    content: normalizeWhitespace(content),
  };
}

function splitLargeChunk(chunk: KnowledgeChunk) {
  if (chunk.content.length <= CHUNK_MAX_CHARS) {
    return [chunk];
  }

  const chunks: KnowledgeChunk[] = [];

  for (let start = 0; start < chunk.content.length; start += CHUNK_TARGET_CHARS) {
    const content = chunk.content.slice(start, start + CHUNK_MAX_CHARS).trim();

    if (content) {
      chunks.push({
        ...chunk,
        id: `${chunk.id}:${chunks.length}`,
        content,
      });
    }
  }

  return chunks;
}

function htmlToText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6]|blockquote|table|tr)>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .join("\n\n");
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function routePathToSegments(routePath: string) {
  return normalizeRoutePath(routePath)
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function rankChunks(question: string, chunks: KnowledgeChunk[]) {
  const questionTokens = tokenize(question);

  if (questionTokens.length === 0) {
    return [];
  }

  return chunks
    .map((chunk) => ({
      chunk,
      score: scoreChunk(questionTokens, chunk),
    }))
    .filter((item) => item.score >= 0.08)
    .sort((left, right) => right.score - left.score)
    .map((item) => ({
      ...item.chunk,
      score: item.score,
    }));
}

function scoreChunk(questionTokens: string[], chunk: KnowledgeChunk) {
  const contentTokens = tokenize(`${chunk.documentTitle} ${chunk.content}`);
  const tokenCounts = new Map<string, number>();

  for (const token of contentTokens) {
    tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
  }

  let score = 0;

  for (const token of new Set(questionTokens)) {
    const count = tokenCounts.get(token) ?? 0;

    if (count > 0) {
      score += Math.min(count, 3) * tokenWeight(token);
    }
  }

  const titleTokens = new Set(tokenize(chunk.documentTitle));
  const titleHits = questionTokens.filter((token) => titleTokens.has(token)).length;

  return score / Math.sqrt(contentTokens.length + 24) + titleHits * 0.2;
}

function tokenize(value: string) {
  const normalized = value.toLowerCase();
  const latinTokens = normalized.match(/[a-z0-9][a-z0-9_-]{1,}/g) ?? [];
  const cjkTokens = normalized.match(/[\u4e00-\u9fff]/g) ?? [];
  const cjkBigrams: string[] = [];

  for (let index = 0; index < cjkTokens.length - 1; index += 1) {
    cjkBigrams.push(`${cjkTokens[index]}${cjkTokens[index + 1]}`);
  }

  return [...latinTokens, ...cjkTokens, ...cjkBigrams].filter((token) => !isStopToken(token));
}

function isStopToken(token: string) {
  return new Set([
    "的",
    "了",
    "和",
    "是",
    "在",
    "有",
    "我",
    "你",
    "他",
    "它",
    "这",
    "那",
    "吗",
    "呢",
    "么",
    "什么",
    "怎么",
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
  ]).has(token);
}

function tokenWeight(token: string) {
  if (/^[a-z0-9_-]+$/.test(token)) {
    return token.length >= 4 ? 1.5 : 1;
  }

  return token.length >= 2 ? 1.35 : 0.45;
}

function toCitation(chunk: KnowledgeChunk & { score: number }, index: number): KnowledgeCitation {
  return {
    id: String(index),
    title: chunk.documentTitle,
    href: toHref(chunk.routePath),
    snippet: buildSnippet(chunk.content),
    score: Number(chunk.score.toFixed(3)),
  };
}

function buildSnippet(content: string) {
  const normalized = normalizeWhitespace(content);
  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized;
}

function buildExtractiveAnswer(chunks: Array<KnowledgeChunk & { score: number }>) {
  const keyPoints = chunks
    .slice(0, 3)
    .map((chunk, index) => `${index + 1}. ${buildSnippet(chunk.content)} [${index + 1}]`)
    .join("\n");

  return `根据当前知识库中检索到的资料，最相关的信息如下：\n\n${keyPoints}\n\n以上内容只来自下方引用来源；如果要用于对外答复，建议打开原文核对表述。`;
}

function allowExtractiveFallback() {
  return process.env.KB_ALLOW_EXTRACTIVE_FALLBACK === "true";
}

function resolveModelSettings(input: {
  modelProvider?: KnowledgeModelProvider;
  modelId?: string;
  userApiKey?: string;
  allowServerApiKey: boolean;
}): ResolvedModelSettings {
  const provider = input.modelProvider ?? "deepseek";

  if (provider !== "deepseek") {
    throw new KnowledgeModelError("暂不支持这个模型供应商。", 400);
  }

  const modelId = resolveDeepSeekModel(input.modelId);
  const userApiKey = input.userApiKey?.trim();
  const serverApiKey =
    process.env.KB_DEEPSEEK_API_KEY ??
    process.env.DEEPSEEK_API_KEY ??
    process.env.KB_OPENAI_API_KEY ??
    process.env.OPENAI_API_KEY;
  const credentialSource: KnowledgeAnswer["model"]["credentialSource"] = input.allowServerApiKey
    ? "server"
    : "user";
  const apiKey = input.allowServerApiKey ? serverApiKey : userApiKey;

  if (!apiKey) {
    if (allowExtractiveFallback()) {
      return {
        apiKey: "",
        baseUrl: getDeepSeekBaseUrl(),
        modelId,
        publicModel: {
          provider,
          id: modelId,
          credentialSource,
        },
      };
    }

    throw new KnowledgeModelError(
      input.allowServerApiKey
        ? "管理员模型密钥尚未配置。请配置 KB_DEEPSEEK_API_KEY。"
        : "请输入你的 DeepSeek API Key 后再使用 AI 问答。",
      input.allowServerApiKey ? 503 : 401,
    );
  }

  return {
    apiKey,
    baseUrl: getDeepSeekBaseUrl(),
    modelId,
    publicModel: {
      provider,
      id: modelId,
      credentialSource,
    },
  };
}

function resolveDeepSeekModel(modelId?: string): KnowledgeModelId {
  if (modelId === "deepseek-v4-pro" || modelId === "deepseek-v4-flash") {
    return modelId;
  }

  const envModel = process.env.KB_DEEPSEEK_CHAT_MODEL ?? process.env.KB_CHAT_MODEL;

  if (envModel === "deepseek-v4-pro" || envModel === "deepseek-v4-flash") {
    return envModel;
  }

  return DEFAULT_DEEPSEEK_MODEL;
}

function getDeepSeekBaseUrl() {
  return (
    process.env.KB_DEEPSEEK_BASE_URL ??
    process.env.KB_OPENAI_BASE_URL ??
    DEFAULT_DEEPSEEK_BASE_URL
  ).replace(/\/+$/g, "");
}

async function generateModelAnswer(
  question: string,
  chunks: Array<KnowledgeChunk & { score: number }>,
  modelSettings: ReturnType<typeof resolveModelSettings>,
) {
  if (!modelSettings.apiKey && allowExtractiveFallback()) {
    return buildExtractiveAnswer(chunks);
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "你是文览知识库客服助手。只能依据提供的资料回答；资料不足时必须说明当前知识库没有可靠依据。回答要简洁、准确，并在关键句后使用 [1]、[2] 这样的引用编号。",
    },
    {
      role: "user",
      content: `问题：${question}\n\n资料：\n${buildModelContext(chunks)}`,
    },
  ];

  try {
    const response = await fetch(`${modelSettings.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${modelSettings.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelSettings.modelId,
        messages,
        temperature: 0.2,
        max_tokens: 800,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      if (allowExtractiveFallback()) {
        return buildExtractiveAnswer(chunks);
      }

      throw new KnowledgeModelError(`AI 模型调用失败：HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const answer = payload.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      if (allowExtractiveFallback()) {
        return buildExtractiveAnswer(chunks);
      }

      throw new KnowledgeModelError("AI 模型没有返回有效回答。");
    }

    return answer;
  } catch (error) {
    if (error instanceof KnowledgeModelError) {
      throw error;
    }

    if (allowExtractiveFallback()) {
      return buildExtractiveAnswer(chunks);
    }

    throw new KnowledgeModelError("AI 模型调用失败，请检查模型网关、Key 或网络连接。");
  }
}

function buildModelContext(chunks: Array<KnowledgeChunk & { score: number }>) {
  let usedChars = 0;
  const context: string[] = [];

  for (const [index, chunk] of chunks.entries()) {
    const source = `[${index + 1}] ${chunk.documentTitle}\n${chunk.content}`;

    if (usedChars + source.length > MAX_CONTEXT_CHARS) {
      break;
    }

    context.push(source);
    usedChars += source.length;
  }

  return context.join("\n\n");
}
