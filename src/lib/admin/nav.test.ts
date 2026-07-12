import { describe, expect, it } from "vitest";
import { adminNavGroupIsActive, defaultOpenAdminGroups } from "./nav";

describe("admin navigation groups", () => {
  it("marks a group active when the current path belongs to one of its items", () => {
    expect(adminNavGroupIsActive({ items: [{ href: "/admin/images" }] }, "/admin/images")).toBe(true);
    expect(adminNavGroupIsActive({ items: [{ href: "/admin/images" }] }, "/admin/images/123")).toBe(true);
    expect(adminNavGroupIsActive({ items: [{ href: "/admin/images" }] }, "/admin/users")).toBe(false);
  });

  it("opens the matching group by default", () => {
    const groups = [
      { id: "images", items: [{ href: "/admin/images" }] },
      { id: "users", items: [{ href: "/admin/users" }] },
    ];

    expect(defaultOpenAdminGroups(groups, "/admin/users")).toEqual(["users"]);
  });
});
