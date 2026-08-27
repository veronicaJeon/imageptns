import { describe, expect, it } from "vitest";
import { ADMIN_NAV_GROUPS, ADMIN_NAV_PRIMARY_ITEMS, adminNavGroupIsActive, defaultOpenAdminGroups } from "./nav";

describe("admin navigation groups", () => {
  it("marks a group active when the current path belongs to one of its items", () => {
    expect(adminNavGroupIsActive({ items: [{ href: "/admin/images" }] }, "/admin/images")).toBe(true);
    expect(adminNavGroupIsActive({ items: [{ href: "/admin/images" }] }, "/admin/images/123")).toBe(true);
    expect(adminNavGroupIsActive({ items: [{ href: "/admin/images" }] }, "/admin/users")).toBe(false);
  });

  it("groups public website pages under webpage management", () => {
    const webPages = ADMIN_NAV_GROUPS.find((group) => group.id === "web-pages");
    expect(webPages?.label).toBe("웹페이지 관리");
    expect(webPages?.items.map((item) => item.href)).toEqual([
      "/admin/notices",
      "/admin/library-guidance",
      "/admin/library-ads",
      "/admin/about-page",
    ]);
  });

  it("keeps the policy document cabinet, legal, fees, pricing, and lifecycle under operations policy", () => {
    const policy = ADMIN_NAV_GROUPS.find((group) => group.id === "operations-policy");
    expect(policy?.label).toBe("운영정책관리");
    expect(policy?.items.map((item) => item.href)).toEqual([
      "/admin/policy-documents",
      "/admin/legal",
      "/admin/commission",
      "/admin/pricing",
      "/admin/data-lifecycle",
    ]);
  });

  it("shows general, photo, and bank-transfer work queues as separate primary links", () => {
    expect(ADMIN_NAV_PRIMARY_ITEMS.map((item) => item.href)).toEqual([
      "/admin/support",
      "/admin/photo-requests",
      "/admin/payment-requests",
    ]);
    expect(ADMIN_NAV_PRIMARY_ITEMS.map((item) => item.countKey)).toEqual(["general", "photo", "payment"]);
    expect(ADMIN_NAV_GROUPS.find((group) => group.id === "finance")?.items.map((item) => item.href))
      .toEqual(["/admin/payouts"]);
    expect(ADMIN_NAV_GROUPS.some((group) => group.id === "content")).toBe(false);
  });

  it("opens the matching group by default", () => {
    const groups = [
      { id: "images", items: [{ href: "/admin/images" }] },
      { id: "users", items: [{ href: "/admin/users" }] },
    ];

    expect(defaultOpenAdminGroups(groups, "/admin/users")).toEqual(["users"]);
  });
});
