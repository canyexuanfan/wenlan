"use client";

import { useCallback, useRef, useState } from "react";

type SourceDocumentFrameProps = Readonly<{
  title: string;
  html: string;
}>;

export function SourceDocumentFrame({ title, html }: SourceDocumentFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(720);

  const syncHeight = useCallback(() => {
    const frame = iframeRef.current;
    const frameDocument = frame?.contentDocument;

    if (!frameDocument) {
      return;
    }

    const nextHeight = Math.max(
      720,
      frameDocument.documentElement.scrollHeight,
      frameDocument.body?.scrollHeight ?? 0,
    );
    setHeight(nextHeight + 24);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      title={`${title} source document`}
      className="source-document-frame"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={buildSourceDocument(html)}
      style={{ height }}
      onLoad={syncHeight}
    />
  );
}

function buildSourceDocument(html: string) {
  const trimmedHtml = html.trim();

  if (/<!doctype\s+html/i.test(trimmedHtml) || /<html[\s>]/i.test(trimmedHtml)) {
    return trimmedHtml;
  }

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>${trimmedHtml}</body>
</html>`;
}
