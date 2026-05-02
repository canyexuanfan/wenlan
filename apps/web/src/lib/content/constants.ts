import type { AccessMode } from "./types";

export const accessLabelMap: Record<AccessMode, string> = {
  public: "公开",
  login: "登录可见",
  private: "私有",
  specific_users: "指定用户",
  group: "用户组",
};
