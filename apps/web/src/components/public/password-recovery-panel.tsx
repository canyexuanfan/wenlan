"use client";

import { useRef, useState } from "react";

import { useVerificationCodeCooldown } from "@/components/public/use-verification-code-cooldown";

type PasswordRecoveryPanelProps = {
  initialEmail: string;
  initialError: string;
  initialNotice: string;
};

type FeedbackState =
  | { type: "idle"; message: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

export function PasswordRecoveryPanel({
  initialEmail,
  initialError,
  initialNotice,
}: PasswordRecoveryPanelProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState(initialEmail);
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
    "wenlan:password-recovery-code-cooldown",
  );

  async function handleSendVerificationCode() {
    const form = formRef.current;

    if (!form || isSendingCode || isCoolingDown) {
      return;
    }

    const formData = new FormData(form);
    setIsSendingCode(true);

    try {
      const response = await fetch("/auth/password-recovery/request", {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
          "x-password-recovery-code-request": "fetch",
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

      startCooldown();
      setFeedback({
        type: "success",
        message: payload.notice || "验证码已发送，请查收邮箱并继续重置密码。",
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
      {feedback.type === "error" && feedback.message ? (
        <p className="form-error" role="alert">
          {feedback.message}
        </p>
      ) : null}

      {feedback.type === "success" && feedback.message ? (
        <p className="form-success" role="status" aria-live="polite">
          {feedback.message}
        </p>
      ) : null}

      <article className="account-inline-section">
        <h2 className="account-section-title">第一步：发送验证码</h2>
        <form ref={formRef} className="login-form">
          <label htmlFor="password-recovery-email">邮箱</label>
          <input
            id="password-recovery-email"
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="输入注册时使用的邮箱"
            autoComplete="email"
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
      </article>

      <article className="account-inline-section">
        <h2 className="account-section-title">第二步：设置新密码</h2>
        <form action="/auth/password-recovery/verify" method="post" className="login-form">
          <label htmlFor="password-recovery-email-confirm">邮箱</label>
          <input
            id="password-recovery-email-confirm"
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="与上面相同的邮箱"
            autoComplete="email"
            required
          />

          <label htmlFor="password-recovery-code">邮箱验证码</label>
          <input
            id="password-recovery-code"
            type="text"
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="输入收到的 6 位验证码"
            required
          />

          <label htmlFor="password-recovery-password">新密码</label>
          <input
            id="password-recovery-password"
            type="password"
            name="password"
            minLength={8}
            autoComplete="new-password"
            placeholder="至少 8 位"
            required
          />

          <label htmlFor="password-recovery-password-confirm">确认新密码</label>
          <input
            id="password-recovery-password-confirm"
            type="password"
            name="confirmPassword"
            minLength={8}
            autoComplete="new-password"
            placeholder="再输入一次新密码"
            required
          />

          <button type="submit" className="hero-button hero-button-strong login-submit">
            保存新密码
          </button>
        </form>
      </article>
    </>
  );
}
