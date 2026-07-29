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
    supabaseAuthNote:
      "회원가입 인증 메일은 앱 Gmail SMTP가 아니라 Supabase Auth 이메일 설정에서 발송됩니다. Supabase Auth SMTP 설정과 발송 제한을 별도로 확인해야 합니다.",
  });
}
