"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useId, useState, useTransition } from "react";

import { UserAvatar } from "@/components/account/user-avatar";

type AccountAvatarFormProps = {
  avatarUrl: string | null;
  displayName: string | null;
  email: string | null;
};

const copy = {
  chooseFile: "\u9009\u62e9\u5934\u50cf\u56fe\u7247",
  upload: "\u4e0a\u4f20\u5934\u50cf",
  uploading: "\u4e0a\u4f20\u4e2d...",
  helper:
    "\u652f\u6301 JPG\u3001PNG \u683c\u5f0f\uff0c\u6587\u4ef6\u5927\u5c0f\u4e0d\u8d85\u8fc7 5MB\uff0c\u5efa\u8bae\u5c3a\u5bf8 400x400 \u50cf\u7d20\u3002",
  selectFirst: "\u8bf7\u9009\u62e9\u4e00\u5f20\u5934\u50cf\u56fe\u7247\u540e\u518d\u4e0a\u4f20\u3002",
  uploadFailed: "\u5934\u50cf\u4e0a\u4f20\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002",
  uploadDone: "\u5934\u50cf\u5df2\u66f4\u65b0\u3002",
  networkFailed: "\u7f51\u7edc\u5f02\u5e38\uff0c\u5934\u50cf\u4e0a\u4f20\u5931\u8d25\u3002",
};

export function AccountAvatarForm({
  avatarUrl,
  displayName,
  email,
}: Readonly<AccountAvatarFormProps>) {
  const router = useRouter();
  const inputId = useId();
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSelectedFileName(file?.name ?? "");
    setStatusMessage("");
    setErrorMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage("");
    setErrorMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("avatar");

    if (!(file instanceof File) || file.size <= 0) {
      setErrorMessage(copy.selectFirst);
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/account/avatar", {
          method: "POST",
          body: formData,
        });

        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          setErrorMessage(payload.error ?? copy.uploadFailed);
          return;
        }

        form.reset();
        setSelectedFileName("");
        setStatusMessage(copy.uploadDone);
        router.refresh();
      } catch {
        setErrorMessage(copy.networkFailed);
      }
    });
  }

  return (
    <form className="account-avatar-form" onSubmit={handleSubmit}>
      <div className="account-avatar-form-preview">
        <UserAvatar
          avatarUrl={avatarUrl}
          displayName={displayName}
          email={email}
          size="large"
          shape="square"
          fallbackImageSrc="/illustrations/account-center-hero-v1.png"
        />
        <div className="account-avatar-form-copy">
          <p className="account-card-copy">{copy.helper}</p>
          <input
            id={inputId}
            type="file"
            name="avatar"
            accept="image/png,image/jpeg"
            className="account-file-input-hidden"
            disabled={isPending}
            onChange={handleFileChange}
          />

          <div className="account-avatar-form-actions">
            <label htmlFor={inputId} className="hero-button account-avatar-picker">
              {copy.chooseFile}
            </label>

            <button
              type="submit"
              className="hero-button hero-button-strong account-action-button"
              disabled={isPending}
            >
              {isPending ? copy.uploading : copy.upload}
            </button>
          </div>

          {selectedFileName ? (
            <p className="account-avatar-file-name" title={selectedFileName}>
              {selectedFileName}
            </p>
          ) : null}
        </div>
      </div>

      {statusMessage ? (
        <p className="account-status-message is-success" role="status">
          {statusMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="account-status-message is-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
