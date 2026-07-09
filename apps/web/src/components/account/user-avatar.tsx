/* eslint-disable @next/next/no-img-element */

type UserAvatarProps = {
  avatarUrl?: string | null;
  displayName?: string | null;
  email?: string | null;
  size?: "small" | "large";
  className?: string;
  shape?: "circle" | "square";
  fallbackImageSrc?: string | null;
};

function getViewerInitial(displayName?: string | null, email?: string | null) {
  const source = displayName?.trim() || email?.trim() || "U";
  return source.charAt(0).toUpperCase();
}

export function UserAvatar({
  avatarUrl,
  displayName,
  email,
  size = "small",
  className = "",
  shape = "circle",
  fallbackImageSrc = null,
}: Readonly<UserAvatarProps>) {
  const sizeClass = size === "large" ? "account-avatar-large" : "account-avatar";
  const shapeClass = shape === "square" ? "is-square" : "";
  const combinedClassName = [sizeClass, shapeClass, className].filter(Boolean).join(" ");
  const imageSrc = avatarUrl?.trim() || fallbackImageSrc?.trim() || "";

  if (imageSrc) {
    return (
      <span className={`${combinedClassName} has-image`} aria-hidden="true">
        <img src={imageSrc} alt="" className="account-avatar-image" />
      </span>
    );
  }

  return (
    <span className={combinedClassName} aria-hidden="true">
      {getViewerInitial(displayName, email)}
    </span>
  );
}
