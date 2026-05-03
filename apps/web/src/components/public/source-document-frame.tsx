"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SourceDocumentFrameProps = Readonly<{
  title: string;
  html: string;
}>;

export function SourceDocumentFrame({ title, html }: SourceDocumentFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(720);

  const syncHeight = useCallback(() => {
    const frame = iframeRef.current;
    let frameDocument: Document | null | undefined = null;

    try {
      frameDocument = frame?.contentDocument;
    } catch {
      return;
    }

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

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const data = event.data as { type?: string; height?: number };

      if (data?.type !== "wenlan-source-document-resize" || typeof data.height !== "number") {
        return;
      }

      setHeight(Math.max(720, Math.ceil(data.height) + 24));
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      title={`${title} source document`}
      className="source-document-frame"
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      srcDoc={buildSourceDocument(html)}
      style={{ height }}
      onLoad={syncHeight}
    />
  );
}

function buildSourceDocument(html: string) {
  const trimmedHtml = html.trim();

  const resizeBridgeScript = buildResizeBridgeScript();

  if (/<!doctype\s+html/i.test(trimmedHtml) || /<html[\s>]/i.test(trimmedHtml)) {
    return injectResizeBridge(trimmedHtml, resizeBridgeScript);
  }

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>${trimmedHtml}${resizeBridgeScript}</body>
</html>`;
}

function buildResizeBridgeScript() {
  return `<script>
(() => {
  const postHeight = () => {
    const root = document.documentElement;
    const body = document.body;
    const height = Math.max(
      root ? root.scrollHeight : 0,
      body ? body.scrollHeight : 0,
      root ? root.offsetHeight : 0,
      body ? body.offsetHeight : 0
    );
    window.parent.postMessage({ type: "wenlan-source-document-resize", height }, "*");
  };
  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(postHeight);
  };
  window.addEventListener("load", schedule);
  window.addEventListener("resize", schedule);
  document.addEventListener("click", () => setTimeout(schedule, 0), true);
  document.addEventListener("input", schedule, true);
  new MutationObserver(schedule).observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
    characterData: true
  });
  schedule();
})();
</script>`;
}

function injectResizeBridge(html: string, script: string) {
  if (/<\/body\s*>/i.test(html)) {
    return html.replace(/<\/body\s*>/i, `${script}</body>`);
  }

  if (/<\/html\s*>/i.test(html)) {
    return html.replace(/<\/html\s*>/i, `${script}</html>`);
  }

  return `${html}${script}`;
}
