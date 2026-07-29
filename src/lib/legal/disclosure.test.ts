import { describe, expect, it } from "vitest";
import {
  DEFAULT_BUSINESS_DISCLOSURE,
  disclosureIsCompleteForPaidCommerce,
  publicDisclosureRows,
} from "./disclosure";

describe("business disclosures", () => {
  it("keeps draft disclosures out of the public rows", () => {
    expect(publicDisclosureRows(DEFAULT_BUSINESS_DISCLOSURE)).toEqual([]);
    expect(disclosureIsCompleteForPaidCommerce(DEFAULT_BUSINESS_DISCLOSURE)).toBe(false);
  });

  it("requires every statutory commerce field to be visible", () => {
    const complete = {
      ...DEFAULT_BUSINESS_DISCLOSURE,
      representative_name: "대표자",
      business_registration_number: "123-45-67890",
      public_phone: "02-000-0000",
      ecommerce_registration_number: "2026-서울서대문-0000",
      ecommerce_registration_authority: "서울특별시 서대문구청",
      show_representative_name: true,
      show_business_registration_number: true,
      show_public_phone: true,
      show_ecommerce_registration: true,
      is_published: true,
      published_at: "2026-07-29T00:00:00.000Z",
    };

    expect(disclosureIsCompleteForPaidCommerce(complete)).toBe(true);
    expect(publicDisclosureRows(complete)).toContainEqual(["대표자", "대표자"]);
  });
});
