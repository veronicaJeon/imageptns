export interface BankTransferAccount {
  label: string;
  accountNumber: string;
  accountHolder: string;
  bankName: string;
  notice: string;
}

interface BankTransferEnvironment {
  [key: string]: string | undefined;
  BANK_TRANSFER_ACCOUNT_LABEL?: string;
  BANK_TRANSFER_BANK_NAME?: string;
  BANK_TRANSFER_ACCOUNT_NUMBER?: string;
  BANK_TRANSFER_ACCOUNT_HOLDER?: string;
}

export function bankTransferAccountIsConfigured(env: BankTransferEnvironment = process.env) {
  return Boolean(
    env.BANK_TRANSFER_ACCOUNT_LABEL?.trim()
    && env.BANK_TRANSFER_BANK_NAME?.trim()
    && env.BANK_TRANSFER_ACCOUNT_NUMBER?.trim()
    && env.BANK_TRANSFER_ACCOUNT_HOLDER?.trim(),
  );
}

export function getBankTransferAccount(): BankTransferAccount {
  return {
    label: process.env.BANK_TRANSFER_ACCOUNT_LABEL ?? "Image Partners 계좌",
    bankName: process.env.BANK_TRANSFER_BANK_NAME ?? "관리자 지정 은행",
    accountNumber: process.env.BANK_TRANSFER_ACCOUNT_NUMBER ?? "관리자에게 문의",
    accountHolder: process.env.BANK_TRANSFER_ACCOUNT_HOLDER ?? "Image Partners",
    notice: "입금 확인 후 주문을 확정해드립니다",
  };
}
