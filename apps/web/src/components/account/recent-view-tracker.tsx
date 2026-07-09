"use client";

import { useEffect } from "react";

type RecentViewTrackerProps = {
  enabled: boolean;
  targetId: string;
  targetType: "folder" | "document";
};

export function RecentViewTracker({
  enabled,
  targetId,
  targetType,
}: Readonly<RecentViewTrackerProps>) {
  useEffect(() => {
    if (!enabled || !targetId) {
      return;
    }

    const controller = new AbortController();
    const body = JSON.stringify({
      targetId,
      targetType,
    });

    void fetch("/api/account/history", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body,
      signal: controller.signal,
      keepalive: true,
    }).catch(() => undefined);

    return () => {
      controller.abort();
    };
  }, [enabled, targetId, targetType]);

  return null;
}
