export interface BankTransferAccount {
  label: string;
  accountNumber: string;
  accountHolder: string;
  bankName: string;
  notice: string;
}

export function getBankTransferAccount(): BankTransferAccount {
  return {
    label: process.env.BANK_TRANSFER_ACCOUNT_LABEL ?? "Image Partners 계좌",
    bankName: process.env.BANK_TRANSFER_BANK_NAME ?? "관리자 지정 은행",
    accountNumber: process.env.BANK_TRANSFER_ACCOUNT_NUMBER ?? "관리자에게 문의",
    accountHolder: process.env.BANK_TRANSFER_ACCOUNT_HOLDER ?? "Image Partners",
    notice: "입금 확인 즉시 구매확정처리해드립니다",
  };
}

