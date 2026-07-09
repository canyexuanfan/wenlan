"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type FavoriteRemoveButtonProps = {
  targetId: string;
  targetType: "folder" | "document";
};

const copy = {
  idle: "取消收藏",
  pending: "取消中...",
};

export function FavoriteRemoveButton({
  targetId,
  targetType,
}: Readonly<FavoriteRemoveButtonProps>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="hero-button favorite-toggle-button is-inline"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          try {
            const response = await fetch("/api/account/favorites", {
              method: "DELETE",
              headers: {
                "content-type": "application/json",
              },
              body: JSON.stringify({
                targetId,
                targetType,
              }),
            });

            if (!response.ok) {
              return;
            }

            router.refresh();
          } catch {
            return;
          }
        });
      }}
    >
      {isPending ? copy.pending : copy.idle}
    </button>
  );
}
