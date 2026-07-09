"use client";

import { useRef, useState } from "react";

import { useVerificationCodeCooldown } from "@/components/public/use-verification-code-cooldown";

type RegisterFormProps = {
  token: string;
  defaultEmail: string;
  lockedEmail: boolean;
  defaultDisplayName: string;
  initialError: string;
  initialNotice: string;
};

type FeedbackState =
  | { type: "idle"; message: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

export function RegisterForm({
  token,
  defaultEmail,
  lockedEmail,
  defaultDisplayName,
  initialError,
  initialNotice,
}: RegisterFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [email, setEmail] = useState(defaultEmail);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
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
    "wenlan:invite-register-code-cooldown",
  );

  async function handleSendVerificationCode() {
    const form = formRef.current;
    if (!form || isSendingCode || isCoolingDown) {
      return;
    }

    const formData = new FormData(form);
    setIsSendingCode(true);

    try {
      const response = await fetch("/auth/register/email-code/request", {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
          "x-register-email-code-request": "fetch",
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

      setFeedback({
        type: "success",
        message: payload.notice || "验证码已发送，请查收邮箱。",
      });
      startCooldown();
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

      <form ref={formRef} action="/auth/register" method="post" className="login-form">
        <input type="hidden" name="token" value={token} />

        <label htmlFor="register-email">邮箱</label>
        <input
          id="register-email"
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          readOnly={lockedEmail}
          placeholder={lockedEmail ? undefined : "输入你要注册的邮箱"}
          autoComplete="email"
          required
        />

        <label htmlFor="register-display-name">称呼</label>
        <input
          id="register-display-name"
          type="text"
          name="displayName"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="姓名或常用称呼"
          autoComplete="name"
          required
        />

        <label htmlFor="register-password">密码</label>
        <input
          id="register-password"
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="至少 8 位密码"
          minLength={8}
          autoComplete="new-password"
          required
        />

        <label htmlFor="register-verification-code">邮箱验证码</label>
        <div className="verification-code-row">
          <input
            id="register-verification-code"
            type="text"
            name="verificationCode"
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value)}
            inputMode="numeric"
            placeholder="输入邮箱验证码"
            autoComplete="one-time-code"
            required
          />
          <button
            type="button"
            onClick={handleSendVerificationCode}
            className="hero-button verification-code-button"
            disabled={isSendingCode || isCoolingDown}
          >
            {isSendingCode ? "发送中..." : isCoolingDown ? `${remainingSeconds}s后重发` : "发送验证码"}
          </button>
        </div>

        <button type="submit" className="hero-button hero-button-strong login-submit">
          创建账号
        </button>
      </form>
    </>
  );
}
