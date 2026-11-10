# Cloudflare Workers 전환 런북

> 기준일: 2026-11-10
> 목표: 공개 웹·일반 API·예약 정리를 Cloudflare Workers로 옮기고 Vercel CPU 소비를 최소화한다.

## 전환 구조

- Next.js 16.4는 `@opennextjs/cloudflare`로 Worker 번들을 만든다.
- 공개 페이지, 인증, 일반 API, Supabase·Resend·외부 API 호출은 `imagepartners` Worker가 처리한다.
- 사진 검색, 업로드 지문, 방향 보정, 워터마크·썸네일은 `imagepartners-image-runtime`의 Cloudflare Images binding이 처리한다.
- 기존 이미지 파일은 Supabase Storage에 유지하고, R2 활성화 뒤 신규 원본·분석본·워터마크 미리보기·썸네일은 `imagepartners-images` R2 버킷에 저장한다.
- 데이터·만료 업로드 정리는 Cloudflare Cron Trigger가 매일 02:00 UTC에 `/api/cron/auto-reject-stale`를 내부 호출한다.
- 가용성 감시는 같은 Worker의 Cron Trigger가 매시 07·22·37·52분에 `/api/health`를 서비스 바인딩으로 호출한다. 실패 응답은 Cron 실행 실패로 남고 관리자 운영 모니터링은 최근 24시간 96회 기준 커버리지를 표시한다.
- Mistral 합성 진단·의미색인·전체 운영검토를 묶은 고비용 일일 점검은 `OPERATIONS_DAILY_REVIEW_ENABLED=false`로 중단한다. 재개할 때는 비용·필요성을 검토한 뒤 별도 스케줄과 플래그를 함께 복원한다.

TIFF·RAW의 웹 파생본 생성과 20MB를 넘는 입력 처리는 아직 범위 밖이다. R2는 해당 원본을 보관할 수 있지만 실제 업로드 허용 형식과 처리 한도는 별도 회귀 뒤 확장한다.

## R2 신규 이미지 전환

1. Cloudflare Dashboard의 **Storage & databases > R2**에서 R2 구독을 활성화한다. 무료 구간을 우선하며 결제수단 등록이나 유료 플랜 전환은 별도 승인한다.
2. `npx wrangler r2 bucket create imagepartners-images`로 버킷을 만든다.
3. 일반 API·관리자 API·기본 서버 Worker에 `IMAGE_STORAGE` R2 binding을 추가한다.
4. Supabase 마이그레이션 `081_r2_image_storage_provider.sql`을 적용한다. 기존 행은 `supabase` 기본값을 유지한다.
5. binding이 배포되고 `/api/health`의 `r2Storage`가 `ok`인지 확인한 뒤에만 `R2_IMAGE_STORAGE_ENABLED=true`를 설정하고 다시 배포한다.
6. 승인된 사진작가 임시 계정으로 원본 업로드→분석본·미리보기 생성→관리자 승인→공개 썸네일→구매자/관리자 원본 다운로드→완전삭제를 확인한다.

2026-11-06 운영 전환에서 `r2Storage=ok`, 신규 이미지의 원본·분석본·미리보기·전체 공급자 `r2`, 승인 전 비공개·승인 후 공개·반려 후 비공개, 업로드 발급 시간당 100회 제한을 확인했다. 테스트 객체·DB 행·임시 계정은 검증 직후 정리했다.

롤백은 `R2_IMAGE_STORAGE_ENABLED=false`로 되돌려 신규 업로드를 Supabase로 복귀한다. 이미 R2에 저장된 경로는 이중 읽기 계층으로 계속 제공하므로 R2 객체나 DB 공급자 필드를 삭제·되돌리지 않는다.

## 준비 조건

1. 최초 전환은 현재 계정의 Workers Free 플랜으로 검증할 수 있다. 압축 Worker 번들은 약 3.2MB이고 배포는 성공했지만, 일 10만 요청과 CPU 사용량을 관찰해 한도에 가까워지면 Workers Paid 전환을 별도로 승인받는다.
2. `imagepartners.kr` zone과 nameserver가 Cloudflare에서 Active인지 확인한다.
3. Wrangler 인증을 완료한다.

```bash
npx wrangler login
npx wrangler whoami
```

4. 기존 Vercel 운영 환경을 출력 없이 로컬 비공개 파일로 받는다.

```bash
npx vercel env pull .dev.vars --environment=production --yes
```

`.dev.vars`는 Git에서 무시한다. Vercel OIDC·배포 메타데이터는 Cloudflare로 복사하지 않는다.
Vercel CLI가 내려받은 값 끝에 실제 줄바꿈이나 `\\n`을 붙일 수 있으므로 `npm run build:cloudflare`는 `.dev.vars` 값을 정리한 뒤 Next.js 공개 환경값을 번들에 넣는다. Worker Secret을 등록할 때도 같은 정리가 필요하다.

## 빌드와 로컬 검증

```bash
npm ci
npm run typecheck
npm test
npm run build:cloudflare
npx wrangler deploy --dry-run --outdir /tmp/imagepartners-cloudflare-dry-run
npx wrangler dev --local --port 8787
```

최소 확인 경로:

- `/`, `/about`, `/library`, `/login`: HTTP 200
- `/api/categories`: HTTP 200
- `/api/health`: DB·Supabase 두 Storage·활성화된 R2 binding·미리보기 무결성 `ok`; 일일 AI·운영점검 `paused`
- `/api/images/search-by-photo`: 응답 헤더와 상태가 Vercel 이미지 런타임과 같고 Worker의 Sharp 로드 500이 아님
- 비로그인 `/api/uploads/presign`: 401이며 500이 아님

## 최초 Worker 배포와 비밀값

운영 도메인 연결 전 `workers.dev`에서 먼저 배포한다.

```bash
npm run build:cloudflare
npx wrangler deploy
```

Cloudflare Worker Secrets에는 `.env.example`의 실제 운영 서버 비밀과 공개 빌드 설정을 등록한다. 최소 필수값은 다음과 같다.

- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`
- `MISTRAL_API_KEY`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`
- 메일·검색·기능 플래그·계좌이체·비공개 온체인 설정 중 현재 Vercel Production에 존재하는 값
- `APP_RELEASE_SHA=<배포한 main SHA>`, `APP_RELEASE_REF=main`
- R2 binding 검증 전 `R2_IMAGE_STORAGE_ENABLED=false`, 전환 배포에서만 `true`

`VERCEL_*`, `VERCEL_OIDC_TOKEN`, `NX_*`, `TURBO_*`는 옮기지 않는다. 비밀 등록 시 값 끝의 실제 줄바꿈과 `\\n`을 제거한다. 특히 `NEXT_PUBLIC_SUPABASE_*`는 Next.js 빌드에도 고정되므로 비밀 등록 후 `npm run build:cloudflare`와 Worker 배포를 모두 다시 실행하고 `workers.dev` URL에서 스모크 테스트한다.

## 도메인 전환

2026-11-06 현재 `www.imagepartners.kr`과 apex의 Cloudflare Workers 전환은 완료됐다. 아래 절차는 재연결·롤백 후 복구 때도 같은 기준으로 사용한다.

1. Cloudflare zone이 `Active`인지 확인한다.
2. `legacy-origin.imagepartners.kr`은 Vercel origin을 가리키는 DNS-only 레코드로 유지한다. 이 호스트에 Cloudflare Worker route나 proxy를 적용하면 재귀 호출이 생긴다.
3. `www.imagepartners.kr`과 apex를 `imagepartners` Worker Custom Domain에 연결한다.
4. apex는 기존 정책대로 `www`로 307 이동되는지 확인한다.
5. `http://` 요청은 같은 호스트의 `https://`로 이동하고 HTTPS 응답에 HSTS·프레임 차단·MIME 스니핑 차단·제한된 권한 정책이 있는지 확인한다.
6. Supabase OAuth·Auth redirect allowlist, Resend webhook, 외부 모니터가 기존 운영 도메인을 계속 사용하므로 도메인 문자열은 바꾸지 않는다.

전환 직후 공개 페이지, 로그인 콜백, 라이브러리 검색, 관리자 조회, 사진 업로드·썸네일·사진 검색, 문의 메일, `/api/health`를 확인한다. Cloudflare Workers 로그에서 5xx·CPU·메모리·Subrequest 오류를 보고 Vercel Functions 호출량이 Sharp 경로 외에는 감소하는지 확인한다.

## 롤백

다음이면 즉시 공개 도메인을 Vercel로 되돌린다.

- 공개 핵심 경로나 인증 콜백이 반복 5xx
- Supabase 세션 쿠키가 유지되지 않음
- 이미지 업로드·썸네일·사진 검색의 프록시가 실패
- Worker CPU·메모리 한도 초과 또는 압축 번들 한도 초과

Cloudflare Custom Domain 연결을 제거하거나 기존 Vercel DNS 레코드로 복원한 뒤 `/api/health`, `/library`, 로그인, 업로드를 다시 확인한다. `legacy-origin.imagepartners.kr`은 롤백과 무관하게 Vercel origin으로 유지한다.

## Vercel 종료 조건

아래를 모두 만족할 때만 Vercel 프로젝트와 `legacy-origin`을 제거한다.

- Sharp 처리 서비스가 Cloudflare 계층으로 이전됨
- 100MB 원본과 최대 20개 업로드의 메모리·CPU·처리시간 회귀 통과
- pHash·dHash, EXIF 회전, 워터마크, 전시용 WebP 결과가 기존과 동등함
- 7일 이상 Vercel 함수 호출 0건과 Worker 오류율 기준 충족
- 롤백용 이전 배포와 환경값 백업 위치 기록
