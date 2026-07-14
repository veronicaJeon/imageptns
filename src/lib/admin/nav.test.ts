import { describe, expect, it } from "vitest";
import { ADMIN_NAV_GROUPS, adminNavGroupIsActive, defaultOpenAdminGroups } from "./nav";

describe("admin navigation groups", () => {
  it("marks a group active when the current path belongs to one of its items", () => {
    expect(adminNavGroupIsActive({ items: [{ href: "/admin/images" }] }, "/admin/images")).toBe(true);
    expect(adminNavGroupIsActive({ items: [{ href: "/admin/images" }] }, "/admin/images/123")).toBe(true);
    expect(adminNavGroupIsActive({ items: [{ href: "/admin/images" }] }, "/admin/users")).toBe(false);
  });

  it("groups legal, fees, pricing, and lifecycle under operations policy", () => {
    const policy = ADMIN_NAV_GROUPS.find((group) => group.id === "operations-policy");
    expect(policy?.label).toBe("운영정책관리");
    expect(policy?.items.map((item) => item.href)).toEqual([
      "/admin/legal",
      "/admin/commission",
      "/admin/pricing",
      "/admin/data-lifecycle",
    ]);
  });

  it("opens the matching group by default", () => {
    const groups = [
      { id: "images", items: [{ href: "/admin/images" }] },
      { id: "users", items: [{ href: "/admin/users" }] },
    ];

    expect(defaultOpenAdminGroups(groups, "/admin/users")).toEqual(["users"]);
  });
});
