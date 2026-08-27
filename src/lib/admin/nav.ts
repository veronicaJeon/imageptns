export interface AdminNavItem {
  href: string;
  icon: string;
  label: string;
  countKey?: AdminPendingCountKey;
}

export type AdminPendingCountKey = "general" | "photo" | "payment";

export const ADMIN_NAV_PRIMARY_ITEMS: AdminNavItem[] = [
  { href: "/admin/support", icon: "support_agent", label: "일반 문의", countKey: "general" },
  { href: "/admin/photo-requests", icon: "add_photo_alternate", label: "이미지 문의", countKey: "photo" },
  { href: "/admin/payment-requests", icon: "account_balance", label: "입금 확인 요청", countKey: "payment" },
];

export interface AdminNavGroup {
  id: string;
  icon: string;
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "images",
    icon: "photo_library",
    label: "이미지관리",
    items: [
      { href: "/admin", icon: "pending_actions", label: "이미지 검토" },
      { href: "/admin/images", icon: "photo_library", label: "이미지 상세 관리" },
      { href: "/admin/categories", icon: "category", label: "카테고리 관리" },
      { href: "/admin/image-cleanup", icon: "cleaning_services", label: "이미지 정리" },
      { href: "/admin/image-deletion-requests", icon: "delete_forever", label: "삭제 요청" },
      { href: "/admin/image-insights", icon: "insights", label: "이미지 인사이트" },
    ],
  },
  {
    id: "users",
    icon: "manage_accounts",
    label: "유저관리",
    items: [
      { href: "/admin/users", icon: "manage_accounts", label: "회원관리" },
      { href: "/admin/photographer-applications", icon: "how_to_reg", label: "사진작가 승인" },
      { href: "/admin/profile-withdrawal-requests", icon: "person_remove", label: "탈퇴 검토" },
      { href: "/admin/admins", icon: "admin_panel_settings", label: "관리자 계정" },
    ],
  },
  {
    id: "finance",
    icon: "payments",
    label: "비용/정산관리",
    items: [
      { href: "/admin/payouts", icon: "payments", label: "정산 관리" },
    ],
  },
  {
    id: "web-pages",
    icon: "web",
    label: "웹페이지 관리",
    items: [
      { href: "/admin/notices", icon: "campaign", label: "공지사항" },
      { href: "/admin/library-guidance", icon: "format_quote", label: "안내글 관리" },
      { href: "/admin/library-ads", icon: "ads_click", label: "광고·제휴 관리" },
      { href: "/admin/about-page", icon: "apartment", label: "회사소개관리" },
    ],
  },
  {
    id: "operations-policy",
    icon: "policy",
    label: "운영정책관리",
    items: [
      { href: "/admin/policy-documents", icon: "folder_open", label: "운영정책 문서함" },
      { href: "/admin/legal", icon: "gavel", label: "법률정보" },
      { href: "/admin/commission", icon: "percent", label: "수수료정책" },
      { href: "/admin/pricing", icon: "sell", label: "상품가격" },
      { href: "/admin/data-lifecycle", icon: "data_usage", label: "데이터 운영주기 관리" },
    ],
  },
  {
    id: "onchain",
    icon: "account_balance",
    label: "온체인관리",
    items: [
      { href: "/admin/onchain", icon: "account_balance", label: "온체인 운영" },
      { href: "/admin/onchain-registrations", icon: "verified", label: "온체인 등록 이미지" },
      { href: "/admin/onchain-claims", icon: "verified", label: "온체인 클레임" },
    ],
  },
  {
    id: "logs",
    icon: "monitoring",
    label: "로그/통계관리",
    items: [
      { href: "/admin/agent-activity", icon: "smart_toy", label: "에이전트 활동현황" },
      { href: "/admin/operations", icon: "monitor_heart", label: "운영 모니터링" },
      { href: "/admin/presence", icon: "groups", label: "동시접속자" },
      { href: "/admin/activity", icon: "timeline", label: "방문 로그" },
      { href: "/admin/audit", icon: "policy", label: "감사 로그" },
      { href: "/admin/stats", icon: "bar_chart", label: "통계" },
    ],
  },
];

export function adminNavItemIsActive(href: string, pathname: string) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function adminNavGroupIsActive(
  group: { items: Array<Pick<AdminNavItem, "href">> },
  pathname: string,
) {
  return group.items.some((item) => adminNavItemIsActive(item.href, pathname));
}

export function defaultOpenAdminGroups(
  groups: Array<{ id: string; items: Array<Pick<AdminNavItem, "href">> }>,
  pathname: string,
) {
  return groups
    .filter((group) => adminNavGroupIsActive(group, pathname))
    .map((group) => group.id);
}
