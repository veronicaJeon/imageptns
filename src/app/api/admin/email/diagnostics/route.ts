import { NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { verifyGmailSmtp } from "@/lib/email/gmail";
import { resendRuntimeConfiguration } from "@/lib/email/resend";

export async function GET() {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const gmail = await verifyGmailSmtp();
  return NextResponse.json({
    gmail,
    resend: resendRuntimeConfiguration(),
    routingNote:
      "서비스 공개 발신·회신 주소는 contact@imagepartners.kr, 운영 수신함은 imgptns@gmail.com으로 구성합니다. Resend 수신 웹훅 비밀키와 도메인 MX·SPF·DKIM·DMARC 설정을 별도로 완료해야 합니다.",
    supabaseAuthNote:
      "회원가입 인증 메일은 앱 Resend 발송 코드가 아니라 Supabase Auth 이메일 설정에서 발송됩니다. Supabase Auth SMTP의 발신 주소도 contact@imagepartners.kr로 맞춰야 합니다.",
  });
}
