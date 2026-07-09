"use client";

import { useRef, useState } from "react";

import { useVerificationCodeCooldown } from "@/components/public/use-verification-code-cooldown";

type LoginEmailCodePanelProps = {
  initialEmail: string;
  initialError: string;
  initialNotice: string;
  redirectTo: string;
};

type FeedbackState =
  | { type: "idle"; message: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

export function LoginEmailCodePanel({
  initialEmail,
  initialError,
  initialNotice,
  redirectTo,
}: LoginEmailCodePanelProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState(initialEmail);
  const [sentEmail, setSentEmail] = useState(initialEmail);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(() => {
    if (initialError) {
      return { type: "error", message: initialError };
    }

    if (initialNotice) {
      return { type: "success", message: initialNotice };
    }

    return { type: "idle", message: "" };
  });
  const { isCoolingDown, remainingSeconds, startCooldown } = useVerificationCodeCooldown(
    "wenlan:login-email-code-cooldown",
  );

  async function handleSendVerificationCode() {
    const form = formRef.current;

    if (!form || isSendingCode || isCoolingDown) {
      return;
    }

    const formData = new FormData(form);
    const normalizedEmail = String(formData.get("email") ?? "").trim().toLowerCase();
    setIsSendingCode(true);

    try {
      const response = await fetch("/auth/email-code/request", {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
          "x-login-email-code-request": "fetch",
        },
      });

      const payload = (await response.json()) as {
        error?: string;
        notice?: string;
      };

      if (!response.ok || payload.error) {
        setFeedback({
          type: "error",
          message: payload.error || "验证码发送失败，请稍后再试。",
        });
        return;
      }

      setSentEmail(normalizedEmail);
      startCooldown();
      setFeedback({
        type: "success",
        message: payload.notice || "验证码已发送，请查收邮箱。",
      });
    } catch {
      setFeedback({
        type: "error",
        message: "验证码发送失败，请稍后再试。",
      });
    } finally {
      setIsSendingCode(false);
    }
  }

  return (
    <>
      {feedback.type === "success" && feedback.message ? (
        <p className="form-success" role="status" aria-live="polite">
          {feedback.message}
        </p>
      ) : null}

      {feedback.type === "error" && feedback.message ? (
        <p className="form-error" role="alert" aria-live="assertive">
          {feedback.message}
        </p>
      ) : null}

      <form ref={formRef} className="login-form login-code-form">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <label htmlFor="login-email-code-address">邮箱</label>
        <input
          id="login-email-code-address"
          type="email"
          name="email"
          placeholder="输入邮箱地址"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          inputMode="email"
          required
        />

        <button
          type="button"
          className="hero-button login-submit"
          onClick={handleSendVerificationCode}
          disabled={isSendingCode || isCoolingDown}
        >
          {isSendingCode ? "发送中..." : isCoolingDown ? `${remainingSeconds}s后重发` : "发送验证码"}
        </button>
      </form>

      {sentEmail ? (
        <form action="/auth/email-code/verify" method="post" className="login-form login-code-form">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="email" value={sentEmail} />
          <label htmlFor="login-email-code-token">验证码</label>
          <input
            id="login-email-code-token"
            type="text"
            name="token"
            placeholder="输入邮箱中的验证码"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
            required
          />

          <button type="submit" className="hero-button hero-button-strong login-submit">
            验证并登录
          </button>
        </form>
      ) : null}
    </>
  );
}
