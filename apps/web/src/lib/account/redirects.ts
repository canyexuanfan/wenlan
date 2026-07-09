export type AccountSection = "profile" | "avatar" | "security" | "history" | "danger";

const accountSectionAnchorMap: Record<AccountSection, string> = {
  profile: "account-profile",
  avatar: "account-avatar",
  security: "account-security",
  history: "account-history",
  danger: "account-danger",
};

export function buildAccountHref(input: {
  section?: AccountSection;
  profileError?: string | null;
  profileNotice?: string | null;
  passwordError?: string | null;
  passwordNotice?: string | null;
  deleteError?: string | null;
  deleteNotice?: string | null;
}) {
  const params = new URLSearchParams();

  if (input.profileError) {
    params.set("profileError", input.profileError);
  }

  if (input.profileNotice) {
    params.set("profileNotice", input.profileNotice);
  }

  if (input.passwordError) {
    params.set("passwordError", input.passwordError);
  }

  if (input.passwordNotice) {
    params.set("passwordNotice", input.passwordNotice);
  }

  if (input.deleteError) {
    params.set("deleteError", input.deleteError);
  }

  if (input.deleteNotice) {
    params.set("deleteNotice", input.deleteNotice);
  }

  const query = params.toString();
  const hash = input.section ? `#${accountSectionAnchorMap[input.section]}` : "";

  if (!query) {
    return `/account${hash}`;
  }

  return `/account?${query}${hash}`;
}

export function buildPasswordRecoveryHref(input: {
  email?: string | null;
  error?: string | null;
  notice?: string | null;
}) {
  const params = new URLSearchParams();

  if (input.email?.trim()) {
    params.set("email", input.email.trim());
  }

  if (input.error) {
    params.set("error", input.error);
  }

  if (input.notice) {
    params.set("notice", input.notice);
  }

  const query = params.toString();
  return query ? `/password-recovery?${query}` : "/password-recovery";
}
