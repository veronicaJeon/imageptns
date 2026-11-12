# DB·Storage 백업 복구 런북

> 기준일: 2026-11-12
> 대상: Supabase Postgres·Storage, Cloudflare R2
> 원칙: 운영 원본에 복원하지 않고 격리 환경에서 먼저 검증한다.

## 현재 백업 경계

Image Partners는 Supabase 무료 플랜을 사용한다. 무료 플랜에는 관리형 일일 DB 백업이 없으므로 [Supabase 공식 안내](https://supabase.com/docs/guides/platform/backups)에 따라 소유자 DB 비밀번호가 있는 `supabase db dump` 수동 논리 백업이 최종 복구 수단이다. Supabase DB 백업은 Storage 객체 자체를 포함하지 않고 메타데이터만 포함하므로 Storage는 별도로 보관·복원해야 한다.

현재 앱의 저장 경계는 다음과 같다.

- Postgres·Auth·기존 Storage: Supabase
- 기존 이미지 83개 원본, 163개 미리보기, 81개 분석본과 사이트 자산: Supabase Storage
- 신규 이미지 원본·분석본·미리보기: Cloudflare R2 `imagepartners-images`
- 2026-11-12 훈련 시점 R2 사용자 객체: 0개

## 2026-11-12 1차 격리 복구 훈련

운영 서비스 역할은 조회에만 사용하고, 복원 대상은 Colima에서 실행한 로컬 Supabase였다. 임시 스냅샷 디렉터리는 `0700`, 파일은 `0600`으로 제한했으며 보고서에는 개인정보·객체 경로·비밀값을 남기지 않았다.

| 항목 | 결과 |
| --- | --- |
| 운영 공개 스키마 | 55개 테이블, 26,295행 복원·행별 정규화 해시 일치 |
| 참조 무결성 | 공개 스키마 외래키 92개, 고아 참조 0건 |
| Supabase Storage | 7개 버킷, 332개 객체, 589,153,396바이트 인벤토리 |
| 파일 복원 표본 | 원본·미리보기·분석본·사이트 자산 4개를 격리 Storage에 복원하고 SHA-256 일치 |
| DB-파일 참조 | 이미지 원본·미리보기·분석본 표본 3개가 복원 DB 경로와 일치 |
| R2 | 빈 운영 버킷에 전용 합성 객체 67바이트를 생성해 격리 버킷 복원·SHA-256 일치·양쪽 정리 |
| 스냅샷 생성 | 7.4초 |
| 데이터 복원·검증 RTO | 5.8초 |
| 전체 훈련 시간 | 13.1초 |
| 복원 시 스냅샷 나이 | 6초 |

측정 RTO는 현재 소량의 DB 전체와 Storage 표본 복원 시간이며, 589MB 전체 파일 전송·DNS 전환·사람의 승인 시간을 포함하지 않는다. 현재 운영 RTO 목표는 **4시간 이내**, RPO 목표는 저유입 기간 기준 **7일 이내**로 둔다. 무료 플랜에서 자동 백업을 구성하지 않은 현재 보장 RPO는 없으므로, 주간 수동 논리 백업을 보관하기 전까지 7일 목표는 운영 과제로 유지한다.

훈련 중 과거 이미지 요청 1건이 사후 추가된 `NOT VALID` 제약 때문에 논리 복원에서 거부되는 문제를 발견했다. 마이그레이션 `084_restore_legacy_photo_requests.sql`은 규칙 도입 이전 행만 복원 가능하게 하고 이후 이미지 요청의 연락처·프로젝트·용도·기한 필수 검증은 유지한다.

## 반복 훈련 절차

### 1. 서비스 API 기반 빠른 훈련

운영 프로젝트의 URL과 서비스 역할 키가 로컬 비공개 환경 파일에 있고 로컬 Supabase가 실행 중이어야 한다.

```bash
colima start
npx supabase start
drill_directory="$(mktemp -d /tmp/imagepartners-restore-drill.XXXXXX)"
node --env-file=.dev.vars scripts/backup-restore-drill.mjs "$drill_directory"
node scripts/run-r2-restore-drill.mjs
```

성공 조건:

- 모든 공개 테이블의 행 수와 정규화 해시가 일치한다.
- 모든 공개 외래키의 고아 참조가 0건이다.
- 원본·미리보기·분석본 표본의 DB 경로와 파일 SHA-256이 일치한다.
- R2 복원 해시가 일치하고 합성 객체·임시 Worker·버킷이 모두 제거된다.

서비스 API 훈련은 `auth.users` 비밀번호 해시를 읽지 못하므로 동일 UUID의 로그인 불가 합성 계정만 격리 환경에 만든다. 기존 사용자의 실제 로그인 복구를 검증하는 전체 훈련은 아래 소유자 논리 백업으로 수행한다.

### 2. 소유자 전체 논리 백업 훈련

운영 Supabase 프로젝트 소유자 또는 관리자만 수행한다. 현재 브라우저 계정은 운영 프로젝트 접근 권한이 없어 2026-11-12 훈련에서는 실행하지 못했다.

1. Supabase Dashboard `Connect`에서 운영 DB의 세션 풀러 연결 문자열과 DB 비밀번호를 확인한다.
2. [공식 CLI 백업·복원 절차](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)에 따라 역할·스키마·데이터를 각각 덤프한다.
3. 운영과 분리된 새 Supabase 프로젝트 또는 로컬 Supabase에 역할→스키마→데이터 순으로 단일 트랜잭션 복원한다.
4. Auth 로그인, RLS, 공개 이미지, 주문·다운로드·정산, 정책 문서를 표본 검증한다.
5. Storage 객체는 별도 백업에서 복원하고 DB 경로와 SHA-256을 대조한다.
6. 임시 파일은 권한을 제한하고 훈련 종료 즉시 완전삭제한다.

비밀번호, API 키, SMTP·OAuth 비밀값은 DB 백업 문서나 산출물에 기록하지 않는다. 장애 복구 시 권한 있는 비밀 저장소에서 다시 주입하고 노출이 의심되면 회전한다.

## 실제 장애 전환과 원복

1. 운영 쓰기를 중단하고 장애 시점·마지막 정상 스냅샷을 기록한다.
2. 격리 Supabase에 DB를 복원하고 Auth·RLS·핵심 참조·Storage 해시를 확인한다.
3. Storage 객체를 기존 논리 버킷 이름과 경로로 복원한다. R2는 새 버킷에서 먼저 검증한다.
4. Cloudflare Workers의 `NEXT_PUBLIC_SUPABASE_URL`, 공개 키, 서비스 역할 키를 새 프로젝트 값으로 교체한다. 공개 환경값은 빌드에 포함되므로 전체 Cloudflare 빌드와 배포를 다시 수행한다.
5. Auth redirect allowlist, Resend SMTP·Webhook, OAuth 설정을 복원한다.
6. `www.imagepartners.kr` DNS는 Cloudflare Worker를 계속 가리키므로 보통 변경하지 않는다. `/api/health`, 로그인, 라이브러리, 주문·다운로드, 관리자 조회를 통과한 뒤 쓰기를 재개한다.
7. 복구 환경이 잘못됐으면 이전 Supabase 비밀값과 R2 binding을 되돌리고 직전 정상 Worker를 재배포한다. 손상 원본에 덮어쓰지 않는다.

## 정리와 기록

- 임시 스냅샷 디렉터리와 로컬 컨테이너는 결과 기록 후 제거한다.
- R2 훈련 객체는 `restore-drill/` 접두사만 사용하며 성공·실패와 관계없이 정리한다.
- 문서에는 개수·바이트·소요시간·해시 일치 여부만 남기고 이메일, UUID, 파일 경로, 키 원문을 남기지 않는다.
- 저유입 기간에는 분기 1회 반복한다. 유료 거래량이 늘거나 스키마·저장소 경계가 크게 바뀌면 즉시 다시 수행한다.
