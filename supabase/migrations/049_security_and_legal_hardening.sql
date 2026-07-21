-- Security and public legal notice hardening.

-- Full-resolution files must never be readable merely because a visitor is
-- authenticated. Buyer delivery continues through the authorized signed-URL
-- download routes backed by the private images-original bucket.
drop policy if exists "images-full: authenticated read" on storage.objects;

-- Durable AI analysis quota. The route calls this with the service role after
-- verifying that the current account is an approved photographer.
create table if not exists public.ai_analysis_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists ai_analysis_requests_user_created_idx
  on public.ai_analysis_requests(user_id, created_at desc);

alter table public.ai_analysis_requests enable row level security;

create or replace function public.consume_ai_analysis_quota(
  target_user_id uuid,
  hourly_limit integer,
  daily_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  requests_last_hour integer;
  requests_last_day integer;
begin
  if target_user_id is null or hourly_limit < 1 or daily_limit < 1 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_user_id::text, 0));

  delete from public.ai_analysis_requests
  where user_id = target_user_id
    and created_at < now() - interval '31 days';

  select
    count(*) filter (where created_at >= now() - interval '1 hour'),
    count(*) filter (where created_at >= now() - interval '1 day')
  into requests_last_hour, requests_last_day
  from public.ai_analysis_requests
  where user_id = target_user_id
    and created_at >= now() - interval '1 day';

  if requests_last_hour >= hourly_limit or requests_last_day >= daily_limit then
    return false;
  end if;

  insert into public.ai_analysis_requests (user_id) values (target_user_id);
  return true;
end;
$$;

revoke all on function public.consume_ai_analysis_quota(uuid, integer, integer) from public;
revoke all on function public.consume_ai_analysis_quota(uuid, integer, integer) from anon;
revoke all on function public.consume_ai_analysis_quota(uuid, integer, integer) from authenticated;
grant execute on function public.consume_ai_analysis_quota(uuid, integer, integer) to service_role;

-- Replace the initial placeholder notices with operational drafts. Business
-- registration and representative details must be added before paid commerce.
insert into public.legal_documents (slug, title, body, published_at, updated_at)
values
  (
    'privacy',
    '개인정보처리방침',
    $privacy$시행일: 2026년 7월 21일

Image Partners(이하 ‘서비스’)는 개인정보 보호법 등 관계 법령을 준수하며, 이용자의 개인정보를 다음과 같이 처리합니다.

1. 개인정보의 처리 목적
- 회원 가입과 본인 확인, 로그인 및 계정 관리
- 사진가 신청 심사, 이미지 등록·검수·공개 및 권리 확인
- 이미지 검색, 컬렉션, 사진 요청, 문의 및 고객지원
- 라이선스 거래 준비, 주문·다운로드·정산 기록 관리(해당 기능이 제공되는 경우)
- 서비스 보안, 부정 이용 방지, 오류 분석 및 이용 현황 확인

2. 처리하는 개인정보 항목
- 회원: 이름, 이메일, 비밀번호의 암호화된 인증정보, 소속, 역할, 프로필 이미지
- 사진가 신청자: 이름, 소속, 전화번호, 주요 활동 지역, 소개, 심사 결과 및 관리자 메모
- 문의·사진 요청: 이름, 이메일, 전화번호, 소속, 요청 내용, 사용 목적·매체·지역·기간·마감일, 참고 URL
- 이미지 등록: 이미지 파일, 파일명, 촬영일시, 촬영 위치, 카메라 정보, 설명·태그, 저작권·출처·AI 생성 여부에 관한 확인 기록
- 서비스 이용 과정: 접속 일시, IP 주소의 해시값, 브라우저·기기 정보, 방문 경로, referrer, 세션 식별자, 검색·열람·다운로드 등 이용 기록
- Google 로그인 이용 시: Google이 제공하는 계정 식별자, 이메일, 이름 및 프로필 정보

3. 개인정보의 처리 및 보유 기간
- 회원정보: 회원 탈퇴 또는 계정 삭제 완료 시까지. 다만 분쟁 대응이나 법령상 보존 의무가 있는 정보는 해당 기간 동안 분리 보관합니다.
- 사진가 신청·심사 기록: 신청 처리 완료 후 3년 또는 탈퇴 후 3년 중 먼저 도래하는 시점까지를 원칙으로 하되, 계약·권리 분쟁이 계속되는 경우 종료 시까지 보관할 수 있습니다.
- 문의·사진 요청: 처리 완료 후 3년
- 접속·보안·활동 기록: 수집 후 1년 이내를 원칙으로 하며, 보안 사고 조사 중인 기록은 조사 종료 시까지 보관할 수 있습니다.
- 거래·라이선스·정산 기록: 관계 법령상 보존기간 또는 권리관계 존속기간 동안 보관합니다.
보유 목적이 달성되거나 기간이 종료되면 지체 없이 파기 또는 복구하기 어려운 방식으로 비식별화합니다.

4. 개인정보의 제3자 제공
서비스는 원칙적으로 이용자의 개인정보를 제3자에게 판매하거나 제공하지 않습니다. 다만 이용자가 동의한 경우, 법령에 근거가 있는 경우, 또는 이미지 라이선스 거래 이행을 위해 필요한 범위에서 거래 상대방에게 이름 또는 표시명, 라이선스·주문 정보와 같이 최소한의 정보를 제공할 수 있습니다.

5. 개인정보 처리업무의 위탁 및 국외 처리
서비스 운영 과정에서 다음 유형의 수탁자 또는 클라우드 서비스를 이용할 수 있습니다.
- Supabase: 인증, 데이터베이스, 파일 저장
- Vercel: 웹 애플리케이션 호스팅 및 전송
- Google: OAuth 로그인, 이메일 및 Gemini AI 분석(사용 시)
- Resend 및 Gmail: 서비스 이메일 발송
- Groq 및 Mistral AI: 업로드 이미지의 제목·설명·태그 생성(사용 시)
이 과정에서 계정 정보, 이메일, 업로드 이미지 또는 관련 메타데이터가 대한민국 외 지역의 서버에서 일시적으로 처리될 수 있습니다. 서비스는 실제 사용 중인 수탁자, 이전 국가·항목·목적·보유기간을 확인하여 본 방침에 최신 상태로 공개하고 필요한 보호조치를 적용합니다.

6. 이용자의 권리와 행사 방법
이용자는 자신의 개인정보에 대한 열람, 정정, 삭제, 처리정지 및 동의 철회를 요청할 수 있습니다. 프로필 정보는 계정 설정에서 직접 정정할 수 있으며, 그 밖의 요청은 contact@imagepartners.kr로 접수할 수 있습니다. 본인 또는 적법한 대리인 여부 확인 후 관계 법령이 정한 기간 안에 처리 결과를 안내합니다.

7. 개인정보의 파기
전자적 파일은 복구 또는 재생이 어렵도록 삭제하고, 종이 문서는 분쇄 또는 소각합니다. 거래·라이선스·권리 분쟁 등으로 보존이 필요한 정보는 다른 정보와 분리하여 해당 목적에만 이용합니다.

8. 안전성 확보 조치
서비스는 접근 권한 제한, 비공개 원본 저장소와 단기 유효 다운로드 URL, 전송구간 암호화, 관리자 접근 통제, 데이터베이스 행 단위 접근정책, 보안 업데이트, 백업 및 접속기록 점검 등의 보호조치를 적용합니다.

9. 쿠키 및 유사 기술
로그인 유지, 장바구니, 언어 설정, 익명 세션 구분 및 서비스 이용 현황 확인을 위해 쿠키와 localStorage 등 유사 기술을 사용할 수 있습니다. 자세한 내용은 쿠키 정책에서 확인할 수 있습니다.

10. 개인정보 보호 문의
개인정보 보호 및 고충처리 담당: Image Partners 운영팀
이메일: contact@imagepartners.kr
이용자는 개인정보침해신고센터(국번 없이 118) 등 관계 기관에도 상담을 신청할 수 있습니다.

11. 방침의 변경
본 방침이 변경되는 경우 시행일 전에 서비스 공지사항 또는 웹사이트를 통해 변경 내용과 시행일을 알립니다.$privacy$,
    now(),
    now()
  ),
  (
    'terms',
    '이용약관',
    $terms$시행일: 2026년 7월 21일

제1조 목적
본 약관은 Image Partners(이하 ‘서비스’)가 제공하는 이미지 검색, 열람, 사진 요청, 회원·사진가 관리 및 관련 기능의 이용 조건과 서비스 및 회원의 권리·의무를 정합니다.

제2조 약관의 게시와 변경
서비스는 회원이 쉽게 확인할 수 있도록 약관을 웹사이트에 게시합니다. 관계 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 중요한 변경은 시행일과 사유를 사전에 공지합니다. 회원에게 불리한 중요한 변경은 합리적인 기간을 두고 알립니다.

제3조 회원 가입과 계정
회원은 정확하고 최신의 정보를 제공해야 하며 자신의 계정과 인증수단을 안전하게 관리해야 합니다. 타인의 정보를 이용하거나 계정을 양도·대여해서는 안 됩니다. 계정의 무단 사용을 알게 된 경우 즉시 서비스에 알려야 합니다.

제4조 서비스 내용
서비스는 이미지 검색·열람, 컬렉션, 사진 요청, 사진가 신청·업로드·검수, 라이선스 및 다운로드 관리 기능을 제공합니다. 유료 거래, 정산 또는 별도 상품이 개시되는 경우 가격, 결제, 환불, 제공 기간과 조건을 해당 화면 및 별도 거래조건으로 안내합니다.

제5조 사진가와 업로드 콘텐츠
사진가는 자신이 업로드하는 이미지와 메타데이터를 등록·공개·라이선스할 적법한 권한을 보유해야 합니다. 필요한 초상권, 재산권, 상표권, 촬영 허가 및 모델·프로퍼티 릴리즈를 확보해야 하며, 에디토리얼 전용 또는 AI 생성·보정 여부를 정확히 표시해야 합니다. 서비스는 권리 침해 우려, 부정확한 정보, 품질 기준 미달 또는 법령 위반 가능성이 있는 콘텐츠를 비공개·반려·삭제하고 자료 제출을 요청할 수 있습니다.

제6조 이용자의 금지행위
회원은 서비스 또는 타인의 권리를 침해하는 행위, 비정상적인 자동 수집, 접근 권한 우회, 원본 파일의 무단 취득·재배포, 악성코드 전송, 허위 요청, 서비스 운영 방해, 법령 또는 공서양속에 반하는 행위를 해서는 안 됩니다.

제7조 이미지 이용과 라이선스
미리보기 이미지는 검색과 구매·사용 검토 목적으로만 제공됩니다. 실제 이용 범위는 각 이미지의 라이선스 표시, 라이선스 안내, 주문 또는 별도 계약에서 정한 조건을 따릅니다. 출처 표시나 비상업·변경금지 등 개별 조건이 있는 경우 이를 준수해야 합니다.

제8조 서비스 변경과 중단
점검, 장애, 보안 사고, 외부 서비스 장애, 천재지변 또는 운영상 필요한 사유로 서비스의 전부 또는 일부가 일시 중단될 수 있습니다. 서비스는 예측 가능한 중단을 사전에 안내하고, 장애 발생 시 복구와 피해 최소화를 위해 합리적으로 노력합니다.

제9조 이용 제한과 계약 종료
회원이 약관 또는 법령을 위반하거나 서비스 안전을 위협하는 경우 사전 통지 후 이용을 제한할 수 있습니다. 긴급한 보안·권리 침해 상황에서는 우선 제한 후 사유를 알릴 수 있습니다. 회원은 계정 설정을 통해 탈퇴를 요청할 수 있으며, 기존 라이선스·거래·정산·분쟁 관련 기록은 필요한 범위에서 보존될 수 있습니다.

제10조 권리침해 신고
저작권, 초상권 또는 기타 권리 침해를 발견한 경우 대상 이미지, 권리관계와 근거자료를 contact@imagepartners.kr로 제출할 수 있습니다. 서비스는 필요한 경우 이미지를 임시 비공개하고 당사자에게 소명 기회를 제공한 후 조치합니다.

제11조 책임
서비스는 고의 또는 과실로 회원에게 손해를 발생시킨 경우 관계 법령에 따라 책임을 부담합니다. 회원의 귀책사유, 회원 간 또는 회원과 제3자 간 분쟁, 합리적으로 통제하기 어려운 외부 서비스 장애로 인한 손해에 대해서는 서비스의 책임이 제한될 수 있습니다. 본 조는 법령상 배제할 수 없는 소비자 권리를 제한하지 않습니다.

제12조 준거법과 분쟁
본 약관은 대한민국 법령을 따릅니다. 분쟁이 발생한 경우 당사자는 우선 협의하여 해결하며, 해결되지 않는 경우 민사소송법상 관할법원에 제기할 수 있습니다.

제13조 운영자 연락처
운영자: Image Partners
이메일: contact@imagepartners.kr
유료 거래 개시 전 사업자등록상 상호, 대표자, 사업장 주소, 사업자등록번호 및 통신판매 관련 표시사항을 거래 화면에 추가로 고지합니다.$terms$,
    now(),
    now()
  ),
  (
    'license_guide',
    '라이선스 안내',
    $license$시행일: 2026년 7월 21일

1. 기본 원칙
이미지의 저작권은 별도 양도 표시가 없는 한 사진가 또는 정당한 권리자에게 있습니다. 서비스에서 이미지를 열람하거나 미리보는 것만으로 이용 권한이 부여되지는 않습니다. 실제 이용에는 해당 이미지에 표시된 라이선스 또는 별도 계약이 필요합니다.

2. 표준 라이선스
표준 라이선스 이미지는 선택한 사용 목적과 범위 안에서 비독점적으로 이용할 수 있습니다. 원본 또는 실질적으로 동일한 파일의 재판매·재배포, 상표·로고 등록, 불법·명예훼손·오해를 유발하는 사용, 권리자가 특정 상품이나 견해를 보증하는 것처럼 보이게 하는 사용은 허용되지 않습니다.

3. 에디토리얼 이용
에디토리얼 이미지는 보도, 출판, 연구, 교육, 기록 등 사실 전달 맥락에서 이용하는 것을 원칙으로 합니다. 광고·홍보·상품화 등 상업적 보증으로 오인될 수 있는 용도에는 사용할 수 없으며, 필요한 경우 출처와 사진가를 표시해야 합니다.

4. Creative Commons
CC0, CC BY, CC BY-SA, CC BY-NC, CC BY-NC-SA, CC BY-ND, CC BY-NC-ND 등 표시가 있는 이미지는 해당 Creative Commons 조건을 따릅니다. BY는 출처 표시, SA는 동일조건 변경허락, NC는 비영리 이용, ND는 변경금지를 의미합니다. 서비스의 요약보다 해당 라이선스 원문이 우선합니다.

5. 무료 사용 정책
‘무료 사용 가능’ 또는 ‘교육용 무료’ 표시는 가격 정책을 뜻하며 저작권 포기나 무제한 이용을 뜻하지 않습니다. 이미지별 저작권 등급, 사용 목적, 출처 표시, 변경 허용 여부를 함께 확인해야 합니다.

6. 초상권·재산권과 추가 허가
이미지에 식별 가능한 인물, 사유지, 작품, 상표 또는 기타 보호 대상이 포함된 경우 선택한 용도에 따라 별도 허가가 필요할 수 있습니다. 서비스가 명시적으로 릴리즈 보유를 표시하지 않는 한 이용자는 자신의 사용 맥락에 필요한 추가 허가 여부를 확인해야 합니다.

7. AI 생성 이미지
AI 생성 또는 AI 보정 이미지에는 해당 사실이 표시될 수 있습니다. 이용자는 실제 사건·인물·장소의 기록으로 오인시키거나 제3자의 권리를 침해하는 방식으로 사용해서는 안 됩니다.

8. 개별 조건의 우선
이미지 상세화면, 주문 확인서, 견적서 또는 별도 계약에 본 안내와 다른 구체적 조건이 있는 경우 해당 개별 조건이 우선합니다. 사용 범위가 불분명하면 이용 전에 contact@imagepartners.kr로 문의해 주세요.$license$,
    now(),
    now()
  ),
  (
    'cookie',
    '쿠키 정책',
    $cookie$시행일: 2026년 7월 21일

1. 쿠키와 유사 기술
서비스는 브라우저에 저장되는 쿠키와 localStorage를 사용해 로그인 상태, 장바구니, 언어 및 화면 설정, 익명 세션 식별자를 유지할 수 있습니다.

2. 필수 저장정보
인증 세션 쿠키는 로그인과 계정 보안을 위해 사용됩니다. 장바구니와 일부 화면 설정은 브라우저 localStorage에 저장될 수 있습니다. 이를 차단하거나 삭제하면 로그인, 장바구니 또는 설정 복원 기능이 정상 작동하지 않을 수 있습니다.

3. 이용 현황 정보
서비스 개선과 보안을 위해 페이지 경로, referrer, 브라우저 정보, IP 주소의 해시값, 익명 세션 식별자, 이미지 열람·검색·장바구니·다운로드 이벤트를 기록할 수 있습니다. 현재 서비스는 외부 광고 추적 쿠키를 직접 설정하지 않습니다.

4. 보유 기간
브라우저 저장정보는 이용자가 직접 삭제하거나 각 정보에 설정된 만료 시점까지 유지됩니다. 서버에 저장되는 활동 기록은 개인정보처리방침에서 정한 기간 안에 삭제 또는 비식별화합니다.

5. 관리 방법
이용자는 브라우저 설정에서 쿠키를 차단하거나 저장된 쿠키·사이트 데이터를 삭제할 수 있습니다. localStorage는 브라우저의 사이트 데이터 삭제 기능으로 제거할 수 있습니다.

6. 정책 변경과 문의
외부 분석 또는 광고 도구를 새로 도입하는 경우 도구명, 목적과 거부 방법을 본 정책에 반영합니다. 문의는 contact@imagepartners.kr로 접수할 수 있습니다.$cookie$,
    now(),
    now()
  )
on conflict (slug) do update
set title = excluded.title,
    body = excluded.body,
    published_at = excluded.published_at,
    updated_at = excluded.updated_at;
