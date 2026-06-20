export type SignupRole = "buyer" | "photographer";

export type SignupLookupResult =
  | { userExists: false; emailConfirmed: false; providers: string[] }
  | { userExists: true; emailConfirmed: boolean; providers: string[] };

export type SignupFlowAction = "create_account" | "resend_confirmation" | "show_existing_account";

export function normalizeSignupEmail(value: unknown): string {
  if (typeof value !== "string") throw new Error("이메일을 입력해주세요.");
  const email = value.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("올바른 이메일을 입력해주세요.");
  if (email.length > 320) throw new Error("이메일은 320자 이내로 입력해주세요.");
  return email;
}

export function normalizeSignupRole(value: unknown): SignupRole {
  return value === "photographer" ? "photographer" : "buyer";
}

export function normalizeSignupText(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${fieldName}을 입력해주세요.`);
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) throw new Error(`${fieldName}을 입력해주세요.`);
  if (text.length > maxLength) throw new Error(`${fieldName}은 ${maxLength}자 이내로 입력해주세요.`);
  return text;
}

export function normalizeSignupPassword(value: unknown): string {
  if (typeof value !== "string") throw new Error("비밀번호를 입력해주세요.");
  if (value.length < 8) throw new Error("비밀번호는 8자 이상 입력해주세요.");
  if (value.length > 72) throw new Error("비밀번호는 72자 이내로 입력해주세요.");
  return value;
}

export function decideSignupFlow(lookup: SignupLookupResult): SignupFlowAction {
  if (!lookup.userExists) return "create_account";
  if (!lookup.emailConfirmed) return "resend_confirmation";
  return "show_existing_account";
}

export const SIGNUP_EXISTING_ACCOUNT_MESSAGE =
  "가입 이력이 있는 이메일입니다. 로그인 또는 비밀번호 재설정을 이용해주세요.";

export const SIGNUP_CONFIRMATION_RESENT_MESSAGE =
  "이미 가입 절차가 시작된 이메일입니다. 인증메일을 다시 보냈습니다.";

export const SIGNUP_CONFIRMATION_SENT_MESSAGE =
  "입력하신 이메일로 가입 확인 절차를 안내했습니다.";
