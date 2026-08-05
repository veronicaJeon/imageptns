import { describe, expect, it } from "vitest";
import { bankTransferAccountIsConfigured } from "./bank-transfer";

describe("bank transfer configuration", () => {
  it("requires every public account field", () => {
    expect(bankTransferAccountIsConfigured({
      BANK_TRANSFER_ACCOUNT_LABEL: "입금 계좌",
      BANK_TRANSFER_BANK_NAME: "은행",
      BANK_TRANSFER_ACCOUNT_NUMBER: "123-456",
      BANK_TRANSFER_ACCOUNT_HOLDER: "이미지파트너스",
    })).toBe(true);
    expect(bankTransferAccountIsConfigured({
      BANK_TRANSFER_ACCOUNT_LABEL: "입금 계좌",
      BANK_TRANSFER_BANK_NAME: "은행",
      BANK_TRANSFER_ACCOUNT_NUMBER: "",
      BANK_TRANSFER_ACCOUNT_HOLDER: "이미지파트너스",
    })).toBe(false);
  });
});
