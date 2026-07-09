"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type FavoriteToggleButtonProps = {
  enabled: boolean;
  initialFavorited: boolean;
  loginHref?: string;
  targetId: string;
  targetType: "folder" | "document";
  variant?: "hero" | "inline";
};

const copy = {
  add: "收藏",
  added: "已收藏",
  login: "登录后收藏",
  adding: "收藏中...",
  removing: "取消中...",
};

function FavoriteIcon({ active }: Readonly<{ active: boolean }>) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" className="favorite-toggle-icon-svg">
      <path
        d="m12 3.2 2.75 5.57 6.15.89-4.45 4.33 1.05 6.11L12 17.21 6.5 20.1l1.05-6.11L3.1 9.66l6.15-.89L12 3.2Z"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function FavoriteToggleButton({
  enabled,
  initialFavorited,
  loginHref = "/login",
  targetId,
  targetType,
  variant = "hero",
}: Readonly<FavoriteToggleButtonProps>) {
  const router = useRouter();
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();

  if (!enabled) {
    return (
      <Link
        href={loginHref}
        className={`hero-button favorite-toggle-button ${variant === "inline" ? "is-inline" : ""}`}
      >
        <span className="favorite-toggle-icon" aria-hidden="true">
          <FavoriteIcon active={false} />
        </span>
        <span>{copy.login}</span>
      </Link>
    );
  }

  const label = isPending
    ? isFavorited
      ? copy.removing
      : copy.adding
    : isFavorited
      ? copy.added
      : copy.add;

  return (
    <button
      type="button"
      className={`hero-button favorite-toggle-button ${
        variant === "inline" ? "is-inline" : ""
      } ${isFavorited ? "is-active" : ""}`}
      disabled={isPending}
      aria-pressed={isFavorited}
      onClick={() => {
        startTransition(async () => {
          const nextFavorited = !isFavorited;
          setIsFavorited(nextFavorited);

          try {
            const response = await fetch("/api/account/favorites", {
              method: nextFavorited ? "POST" : "DELETE",
              headers: {
                "content-type": "application/json",
              },
              body: JSON.stringify({
                targetId,
                targetType,
              }),
            });

            if (!response.ok) {
              setIsFavorited(!nextFavorited);
              return;
            }

            router.refresh();
          } catch {
            setIsFavorited(!nextFavorited);
          }
        });
      }}
    >
      <span className="favorite-toggle-icon" aria-hidden="true">
        <FavoriteIcon active={isFavorited} />
      </span>
      <span>{label}</span>
    </button>
  );
}
