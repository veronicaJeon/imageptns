import { NextResponse } from "next/server";
import { resolveMx, resolveTxt } from "node:dns/promises";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { verifyGmailSmtp } from "@/lib/email/gmail";
import { verifyResendProvider } from "@/lib/email/resend";

async function safeResolveMx(domain: string) {
  try {
    return await resolveMx(domain);
  } catch {
    return [];
  }
}

async function safeResolveTxt(domain: string) {
  try {
    return (await resolveTxt(domain)).map((parts) => parts.join(""));
  } catch {
    return [];
  }
}

export async function GET() {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const [gmail, resend, receivingMx, sendingMx, sendingTxt, dkimTxt, dmarcTxt] = await Promise.all([
    verifyGmailSmtp(),
    verifyResendProvider(),
    safeResolveMx("imagepartners.kr"),
    safeResolveMx("send.imagepartners.kr"),
    safeResolveTxt("send.imagepartners.kr"),
    safeResolveTxt("resend._domainkey.imagepartners.kr"),
    safeResolveTxt("_dmarc.imagepartners.kr"),
  ]);
  return NextResponse.json({
    gmail,
    resend,
    dns: {
      mxConfigured: receivingMx.length > 0,
      mxHosts: receivingMx.map(({ exchange, priority }) => ({ exchange, priority })),
      sendingMxConfigured: sendingMx.length > 0,
      spfConfigured: sendingTxt.some((value) => value.toLowerCase().startsWith("v=spf1")),
      dkimConfigured: dkimTxt.some((value) => value.toLowerCase().startsWith("p=")),
      dmarcConfigured: dmarcTxt.some((value) => value.toLowerCase().startsWith("v=dmarc1")),
    },
    routingNote:
      "서비스 공개 발신·회신 주소는 contact@imagepartners.kr, 운영 수신함은 imgptns@gmail.com으로 구성합니다. Resend 수신 웹훅 비밀키와 도메인 MX·SPF·DKIM·DMARC 설정을 별도로 완료해야 합니다.",
    supabaseAuthNote:
      "회원가입 인증 메일은 앱 Resend 발송 코드가 아니라 Supabase Auth 이메일 설정에서 발송됩니다. Supabase Auth SMTP의 발신 주소도 contact@imagepartners.kr로 맞춰야 합니다.",
  });
}
