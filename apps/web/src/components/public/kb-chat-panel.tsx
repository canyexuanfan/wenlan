"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type KnowledgeScopeType = "folder" | "document";
type KnowledgeModelProvider = "deepseek";
type KnowledgeModelId = "deepseek-v4-flash" | "deepseek-v4-pro";

type KnowledgeCitation = {
  id: string;
  title: string;
  href: string;
  snippet: string;
  score: number;
};

type KnowledgeChatResponse = {
  answer: string;
  citations: KnowledgeCitation[];
  mode: "model" | "extractive";
  model?: {
    provider: KnowledgeModelProvider;
    id: KnowledgeModelId;
    credentialSource: "server" | "user";
  };
  error?: string;
};

type KnowledgeChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  citations?: KnowledgeCitation[];
  mode?: "model" | "extractive";
  modelLabel?: string;
};

const MODEL_OPTIONS: Array<{
  id: KnowledgeModelId;
  label: string;
}> = [
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
];

const MAX_SAVED_MESSAGES = 40;

export function KnowledgeBaseChatPanel({
  canUseServerModelKey,
  scopeType,
  scopeLabel,
  routePath,
}: Readonly<{
  canUseServerModelKey: boolean;
  scopeType: KnowledgeScopeType;
  scopeLabel: string;
  routePath: string;
}>) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<KnowledgeChatMessage[]>([]);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModelId, setSelectedModelId] =
    useState<KnowledgeModelId>("deepseek-v4-flash");
  const [userApiKey, setUserApiKey] = useState("");
  const threadRef = useRef<HTMLDivElement | null>(null);

  const storageKey = useMemo(() => {
    return `wenlan:kb-chat:${scopeType}:${routePath}`;
  }, [routePath, scopeType]);

  const placeholder = useMemo(() => {
    return `向「${scopeLabel}」提问`;
  }, [scopeLabel]);

  const selectedModelLabel =
    MODEL_OPTIONS.find((option) => option.id === selectedModelId)?.label ?? "DeepSeek";

  useEffect(() => {
    try {
      const savedMessages = window.localStorage.getItem(storageKey);

      if (savedMessages) {
        setMessages(JSON.parse(savedMessages) as KnowledgeChatMessage[]);
      }
    } catch {
      setMessages([]);
    } finally {
      setHasLoadedHistory(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hasLoadedHistory) {
      return;
    }

    try {
      const messagesToSave = messages.slice(-MAX_SAVED_MESSAGES);
      window.localStorage.setItem(storageKey, JSON.stringify(messagesToSave));
    } catch {
      // Local history is only a convenience; chat should still work if storage is unavailable.
    }
  }, [hasLoadedHistory, messages, storageKey]);

  useEffect(() => {
    const thread = threadRef.current;

    if (thread) {
      thread.scrollTop = thread.scrollHeight;
    }
  }, [messages, isLoading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitQuestion();
  }

  async function submitQuestion() {
    if (isLoading) {
      return;
    }

    const trimmedQuestion = question.trim();
    const trimmedUserApiKey = userApiKey.trim();

    if (!trimmedQuestion) {
      setError("请输入一个问题。");
      return;
    }

    if (!canUseServerModelKey && !trimmedUserApiKey) {
      setError("普通用户需要先填写自己的 DeepSeek API Key，才能使用 AI 问答。");
      return;
    }

    setIsLoading(true);
    setError("");
    setQuestion("");
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmedQuestion,
      },
    ]);

    try {
      const result = await fetch("/api/kb/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scopeType,
          routePath,
          question: trimmedQuestion,
          modelProvider: "deepseek",
          modelId: selectedModelId,
          apiKey: canUseServerModelKey ? undefined : trimmedUserApiKey,
        }),
      });
      const payload = (await result.json()) as KnowledgeChatResponse;

      if (!result.ok || payload.error) {
        throw new Error(payload.error || "知识库问答失败。");
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: payload.answer,
          citations: payload.citations,
          mode: payload.mode,
          modelLabel: payload.model ? formatModelLabel(payload.model.id) : selectedModelLabel,
        },
      ]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "知识库问答失败。");
      setQuestion(trimmedQuestion);
    } finally {
      setIsLoading(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submitQuestion();
    }
  }

  return (
    <section className="kb-chat-panel" aria-label="知识库问答">
      <div ref={threadRef} className="kb-chat-thread" aria-live="polite">
        {messages.length === 0 ? (
          <div className="kb-empty-thread">
            <h2>问「{scopeLabel}」</h2>
            <p>
              直接输入问题。回答会依据当前{scopeType === "folder" ? "文件夹" : "文档"}
              中可访问的内容生成，并把引用来源放在回答下方。
            </p>
            <div className="kb-suggestion-list" aria-label="建议问题">
              {buildSuggestions(scopeType).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setQuestion(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={`kb-message kb-message-${message.role}`}
            >
              {message.role === "user" ? (
                <div className="kb-user-question">{message.content}</div>
              ) : (
                <div className="kb-answer-block">
                  <div className="kb-answer-meta">
                    <span>文览助手</span>
                    {message.mode ? <small>{message.modelLabel ?? "AI 生成"}</small> : null}
                  </div>
                  <p>{message.content}</p>

                  {message.citations?.length ? (
                    <section className="kb-related-sources" aria-label="引用来源">
                      <h2>引用来源</h2>
                      <div className="kb-related-grid">
                        {message.citations.map((citation) => (
                          <a key={citation.id} href={citation.href} className="kb-related-card">
                            <span className="kb-related-index">[{citation.id}]</span>
                            <strong>{citation.title}</strong>
                            <small>{citation.snippet}</small>
                          </a>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              )}
            </article>
          ))
        )}

        {isLoading ? (
          <article className="kb-message kb-message-assistant">
            <div className="kb-message-loading">
              <span />
              <span />
              <span />
            </div>
          </article>
        ) : null}
      </div>

      {error ? <p className="kb-chat-error">{error}</p> : null}

      <form className="kb-chat-composer" onSubmit={handleSubmit}>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder={placeholder}
          maxLength={500}
          rows={2}
        />
        <div className="kb-composer-tools">
          <label className="kb-model-select">
            <span>模型</span>
            <select
              value={selectedModelId}
              onChange={(event) => setSelectedModelId(event.target.value as KnowledgeModelId)}
            >
              {MODEL_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button">{scopeType === "folder" ? "文件夹范围" : "文档范围"}</button>
          {canUseServerModelKey ? (
            <span className="kb-key-status">管理员密钥</span>
          ) : (
            <label className="kb-api-key-input">
              <span>API Key</span>
              <input
                value={userApiKey}
                onChange={(event) => setUserApiKey(event.target.value)}
                placeholder="DeepSeek API Key"
                type="password"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          )}
        </div>
        <button className="kb-send-button" type="submit" disabled={isLoading}>
          {isLoading ? "..." : "发送"}
        </button>
      </form>
    </section>
  );
}

function buildSuggestions(scopeType: KnowledgeScopeType) {
  if (scopeType === "folder") {
    return ["这个知识库主要讲了什么？", "请列出最重要的三条结论", "哪些文档最值得先看？"];
  }

  return ["请总结这篇文档", "这篇文档有哪些关键步骤？", "有哪些需要注意的风险？"];
}

function formatModelLabel(modelId: KnowledgeModelId) {
  return MODEL_OPTIONS.find((option) => option.id === modelId)?.label ?? modelId;
}
