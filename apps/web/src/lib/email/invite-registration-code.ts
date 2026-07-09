import "server-only";

import nodemailer from "nodemailer";

const BRAND_NAME = "文览";

type InviteRegistrationCodeMailInput = {
  code: string;
  registerUrl: string;
  siteUrl: string;
  to: string;
};

type MailConfig = {
  from: string;
  host: string;
  pass: string;
  port: number;
  secure: boolean;
  senderName: string;
  user: string;
};

const INVITE_REGISTRATION_SUBJECT_TEMPLATE = `【${BRAND_NAME}】您的验证码是 {CODE}`;
const INVITE_REGISTRATION_COPY = {
  codeLabel: "验证码",
  footerLabel: `此邮件由${BRAND_NAME}系统自动发送，请勿回复。`,
  heading: "注册验证码",
  intro: "您正在通过邀请完成注册，请输入以下验证码。",
  tipLine1: "10 分钟内有效，请勿向他人泄露。",
  tipLine2: "若非你本人操作，请忽略此邮件。",
};

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getMailConfig(): MailConfig {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  const fromEmail = process.env.SMTP_ADMIN_EMAIL?.trim() ?? "";
  const port = Number.parseInt(process.env.SMTP_PORT?.trim() ?? "", 10);
  const user = process.env.SMTP_USER?.trim() ?? "";
  const pass = process.env.SMTP_PASS?.trim() ?? "";
  const configuredSenderName = process.env.SMTP_SENDER_NAME?.trim() ?? "";
  const senderName =
    configuredSenderName && configuredSenderName.toLowerCase() !== "wenlan"
      ? configuredSenderName
      : BRAND_NAME;

  if (!host || !fromEmail || !Number.isFinite(port) || !user || !pass) {
    throw new Error("邮件服务还没有配置好，请联系管理员。");
  }

  return {
    from: `"${senderName}" <${fromEmail}>`,
    host,
    pass,
    port,
    secure: port === 465,
    senderName,
    user,
  };
}

async function getTransporter() {
  if (!transporterPromise) {
    const config = getMailConfig();
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        auth: {
          pass: config.pass,
          user: config.user,
        },
        host: config.host,
        port: config.port,
        secure: config.secure,
      }),
    );
  }

  return transporterPromise;
}

function renderInviteRegistrationCodeHtml(input: InviteRegistrationCodeMailInput) {
  const escapedCode = escapeHtml(input.code);
  const escapedSiteUrl = escapeHtml(input.siteUrl);
  const escapedHeroUrl = escapeHtml(new URL("/branding/invite-register-hero.png", input.siteUrl).toString());

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${INVITE_REGISTRATION_COPY.heading}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6efe5;
        --panel: #fffaf4;
        --panel-soft: #f8efdf;
        --text: #332419;
        --muted: #756454;
        --accent: #c86c37;
        --accent-soft: rgba(200, 108, 55, 0.14);
        --line: rgba(194, 132, 86, 0.22);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Georgia", "Songti SC", "STSong", "Noto Serif SC", "Times New Roman", serif;
        background:
          radial-gradient(circle at top, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0) 34%),
          linear-gradient(180deg, #fbf5ec 0%, var(--bg) 100%);
        color: var(--text);
      }

      .shell {
        width: 100%;
        padding: 36px 16px;
      }

      .card {
        max-width: 620px;
        margin: 0 auto;
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 32px;
        overflow: hidden;
        box-shadow: 0 24px 60px rgba(121, 73, 40, 0.12);
      }

      .hero {
        padding: 0;
        background: #fbf4e7;
      }

      .hero-image {
        width: 100%;
        height: auto;
        display: block;
      }

      .content {
        padding: 28px 30px 34px;
      }

      h1 {
        margin: 0 0 14px;
        text-align: center;
        font-size: 36px;
        line-height: 1.15;
        color: #2f2117;
        letter-spacing: 0.04em;
      }

      p {
        margin: 0;
        font-size: 16px;
        line-height: 1.85;
        color: var(--muted);
      }

      .intro {
        text-align: center;
      }

      .code-panel {
        margin: 28px 0 22px;
        padding: 24px 20px 26px;
        border-radius: 26px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 239, 223, 0.92)),
          var(--panel-soft);
        border: 1px solid rgba(194, 132, 86, 0.2);
        text-align: center;
      }

      .code-label {
        font-size: 13px;
        color: var(--muted);
        letter-spacing: 0.18em;
      }

      .code {
        margin-top: 14px;
        font-size: 44px;
        font-weight: 800;
        line-height: 1;
        letter-spacing: 0.22em;
        color: #503224;
      }

      .tips {
        margin-top: 8px;
        text-align: center;
      }

      .footer {
        margin-top: 24px;
        padding-top: 18px;
        border-top: 1px solid rgba(194, 132, 86, 0.16);
        text-align: center;
        font-size: 13px;
        color: var(--muted);
      }

      @media (max-width: 640px) {
        .shell {
          padding: 18px 10px;
        }

        .content {
          padding: 24px 20px 28px;
        }

        h1 {
          font-size: 30px;
        }

        .code {
          font-size: 32px;
          letter-spacing: 0.12em;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="card">
        <div class="hero">
          <img class="hero-image" src="${escapedHeroUrl}" alt="${BRAND_NAME} 邀请注册横幅" width="799" height="425" />
        </div>
        <div class="content">
          <h1>${INVITE_REGISTRATION_COPY.heading}</h1>
          <p class="intro">${INVITE_REGISTRATION_COPY.intro}</p>

          <div class="code-panel">
            <div class="code-label">${INVITE_REGISTRATION_COPY.codeLabel}</div>
            <div class="code">${escapedCode}</div>
          </div>

          <div class="tips">
            <p>${INVITE_REGISTRATION_COPY.tipLine1}</p>
            <p>${INVITE_REGISTRATION_COPY.tipLine2}</p>
          </div>

          <div class="footer">
            <p>${INVITE_REGISTRATION_COPY.footerLabel}</p>
            <p>${escapedSiteUrl}</p>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function renderInviteRegistrationCodeText(input: InviteRegistrationCodeMailInput) {
  return [
    INVITE_REGISTRATION_COPY.heading,
    "",
    INVITE_REGISTRATION_COPY.intro,
    `${INVITE_REGISTRATION_COPY.codeLabel}：${input.code}`,
    "",
    INVITE_REGISTRATION_COPY.tipLine1,
    INVITE_REGISTRATION_COPY.tipLine2,
    "",
    INVITE_REGISTRATION_COPY.footerLabel,
    input.siteUrl,
  ].join("\n");
}

export async function sendInviteRegistrationCodeEmail(input: InviteRegistrationCodeMailInput) {
  const transporter = await getTransporter();
  const config = getMailConfig();
  const subject = INVITE_REGISTRATION_SUBJECT_TEMPLATE.replace("{CODE}", input.code);

  await transporter.sendMail({
    from: config.from,
    headers: {
      "X-Entity-Ref-ID": `wenlan-invite-register-${Date.now()}-${input.code}`,
    },
    html: renderInviteRegistrationCodeHtml(input),
    subject,
    text: renderInviteRegistrationCodeText(input),
    to: input.to,
  });
}
