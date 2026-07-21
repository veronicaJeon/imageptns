# Image Partners 운영 배포 인수인계

이 문서는 다른 에이전트가 구현 작업과 분리되어 운영 배포만 안전하게 수행하도록 돕는 체크리스트다. 저장소 루트는 `/Users/simini/Documents/Imgptns/imageptns`, 운영 도메인은 `https://www.imagepartners.kr`, Vercel 프로젝트 이름은 `imageptns`다.

## 현재 운영 기준점

- 배포 시각: 2026-07-21 22:09:20 KST
- 릴리스 브랜치: `main`
- 릴리스 커밋 SHA: `2ff0c24f4cb33d3826293a0c453d5cde7999e76a`
- Production deployment ID: `dpl_96izPqHWdBX4aYfZXnHmhtH2eAFA`
- Production URL: `https://imageptns-5kz1l6lda-veronicajeons-projects.vercel.app`
- 운영 상태: `Ready`, `https://www.imagepartners.kr` alias 연결 확인
- 검증 기준: 58개 테스트 파일·245개 테스트 통과, 린트 오류 0(기존 경고 11건), TypeScript·프로덕션 빌드 통과

다음 배포 담당자는 이 기준점과 새 배포의 ID·생성 시각·alias를 비교해 실제 전환 여부를 판단한다.

## 1. 배포 담당자의 책임

배포 담당자는 다음만 수행한다.

1. 배포할 변경 범위와 작업 트리 상태를 확인한다.
2. 승인된 파일만 명시적으로 스테이징하고 캐시된 diff를 검토한다.
3. 테스트, 타입 검사, 린트, 프로덕션 빌드를 통과시킨다.
4. 검증된 변경을 커밋하고 원격 저장소에 푸시한다.
5. 현재 Vercel Production 환경과 Supabase 연결 상태를 비밀 노출 없이 검증한다.
6. 푸시한 커밋과 동일한 소스를 운영에 배포하고 실제 도메인과 DB 기반 API를 스모크 테스트한다.
7. 커밋 SHA, 브랜치, 배포 ID, URL, 검증 결과, 남은 위험을 보고한다.

코드 수정, 데이터 정리, 환경변수 변경, DB 마이그레이션 생성은 별도 승인이 없는 한 배포 업무 범위가 아니다. 실패를 고치기 위해 코드를 임의로 수정하지 말고 구현 담당자에게 반환한다.

## 2. 현재 릴리스 범위

2026-07-21 22:09 릴리스에는 다음 변경이 포함된다.

- 로그인 후 `next` 값을 동일 출처 상대 경로로 제한해 open redirect 차단
- `images-full` 버킷의 전체 로그인 사용자 읽기 정책 제거
- AI 이미지 분석 API에 승인된 사진가 권한, 요청 크기·형식 검증, 시간·일간 쿼터 추가
- 개인정보처리방침, 이용약관, 라이선스 안내, 쿠키 정책 운영 초안 게시
- `nodemailer`, `resend`, `viem`, `wagmi` 및 하위 의존성 보안 업데이트

이번 릴리스에는 Supabase 마이그레션 `049_security_and_legal_hardening.sql`이 포함되며 운영 DB 적용을 완료했다. 운영 환경변수 변경은 없고, AI 사용량은 코드 기본값인 시간당 60회·일간 300회를 적용한다.

배포 직전 아래 명령으로 실제 범위를 다시 확인한다.

```bash
git status --short
git diff --check
git diff --stat
git diff --name-only
```

작업 트리가 dirty일 수 있다. 기존 변경을 삭제하거나 `git reset`, `git checkout --`, `git clean`을 실행하지 않는다. 승인된 범위가 불분명하면 배포를 중단하고 구현 담당자에게 확인한다.

`.superpowers/`, `.tsc_out.txt`, 임시 환경 파일, 로그, 빌드 산출물은 제품 소스가 아니므로 별도 승인 없이 스테이징하지 않는다.

## 3. 사전 검증

저장소 루트에서 순서대로 실행한다.

```bash
npm test
npm run lint
npx tsc --noEmit --pretty false
npm run build
```

하나라도 실패하면 배포하지 않는다. 경고와 실패를 구분해 보고하며, 실패를 숨기기 위해 검사 범위를 줄이지 않는다.

DB 마이그레이션이 있는 릴리스에만 다음을 추가한다. 적용 전 `--dry-run` 결과를 먼저 확인한다.

```bash
npx supabase db push --dry-run
npx supabase db push --yes
supabase migration list
```

## 4. Git 커밋과 원격 푸시

검증을 마친 소스가 운영 배포와 원격 저장소에서 동일하게 재현되도록 커밋과 푸시를 배포 전에 완료한다.

```bash
git status -sb
git diff --check

# 승인된 파일만 경로를 명시해 추가한다. 혼합 작업 트리에서 git add -A를 사용하지 않는다.
git add <approved-path-1> <approved-path-2> ...

# 커밋 대상 최종 검토
git diff --cached --check
git diff --cached --stat
git diff --cached

git commit -m "<release-summary>"
git fetch origin
git push -u origin "$(git branch --show-current)"
git rev-parse HEAD
```

원격 기본 브랜치에서 직접 작업하는 저장소 정책이면 해당 브랜치에 푸시한다. 보호 브랜치 또는 PR 정책이 있으면 `codex/<release-name>` 브랜치를 만들어 푸시하고 PR을 병합한 후 운영 배포한다. 강제 푸시와 `--no-verify`는 사용하지 않는다.

푸시 후 다음으로 원격 브랜치가 로컬 커밋을 가리키는지 확인한다.

```bash
BRANCH="$(git branch --show-current)"
test "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$BRANCH")"
git status -sb
```

커밋 이후 파일을 수정했다면 기존 검증 결과를 재사용하지 않는다. 변경을 다시 검토·검증·커밋·푸시한 후 배포한다.

배포가 끝난 뒤 이 문서의 현재 운영 기준점, 배포 ID, 검증 결과만 갱신하는 문서 전용 커밋은 애플리케이션 재배포 대상에서 제외할 수 있다. 이 경우 직전 애플리케이션 릴리스 커밋 SHA와 문서 커밋 SHA를 혼동하지 않도록 완료 보고에 둘 다 기록한다.

## 5. Vercel·Supabase 운영 환경 확인

운영 중인 배포, 현재 Vercel Project Settings, Supabase 상태는 서로 다른 계층이다. 하나가 정상이라고 다른 계층도 정상이라고 추정하지 않는다.

먼저 현재 운영 배포를 식별한다.

```bash
npx vercel inspect https://www.imagepartners.kr
```

그다음 비밀값을 직접 사용하지 않고 운영 앱의 DB 기반 API를 확인한다.

```bash
curl -sS -i https://www.imagepartners.kr/api/stats | sed -n '1,30p'
curl -sS -i 'https://www.imagepartners.kr/api/images?limit=1' | sed -n '1,60p'
```

현재 Production 환경을 임시 파일로 받아 검증한다.

```bash
npx vercel env pull /tmp/imageptns-production.env --environment=production --yes
node ~/.codex/skills/verify-vercel-supabase-prod/scripts/check-vercel-supabase-prod.mjs /tmp/imageptns-production.env
rm -f /tmp/imageptns-production.env
```

키 원문, 토큰, 전체 `.env` 내용은 터미널 출력이나 보고서에 남기지 않는다. 임시 파일은 성공·실패와 관계없이 삭제한다. 운영 앱은 정상인데 현재 Project Settings 검증이 실패하면 새 배포가 장애를 만들 수 있으므로 배포하지 않는다.

## 6. 운영 배포

모든 사전 검증이 통과한 경우 저장소 루트에서 실행한다.

```bash
npx vercel deploy --prod --yes
```

완료 출력에서 Production deployment URL과 alias를 기록한다. 명령 성공만으로 완료 처리하지 않고 실제 운영 도메인이 새 배포를 가리키는지 확인한다.

```bash
npx vercel inspect https://www.imagepartners.kr
```

배포 직후 작업 트리가 커밋 이후 달라지지 않았는지 확인한다. 출력이 있으면 원격 커밋과 다른 소스가 배포됐을 수 있으므로 완료 처리하지 않는다.

```bash
git diff --exit-code HEAD
git status --short
```

Vercel CLI로 직접 배포한 경우 완료 보고서에 `git rev-parse HEAD`의 커밋 SHA와 Production deployment ID를 함께 기록한다. Vercel Git 연동 배포라면 `vercel inspect` 또는 Vercel 대시보드에서 배포의 Git SHA가 해당 커밋과 같은지 확인한다.

## 7. 배포 후 스모크 테스트

다음 공개 경로와 응답을 확인한다.

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://www.imagepartners.kr/library
curl -sS -i 'https://www.imagepartners.kr/api/images?limit=1' | sed -n '1,60p'
curl -sS -i https://www.imagepartners.kr/api/categories | sed -n '1,40p'
curl -sS -i 'https://www.imagepartners.kr/api/cart/availability?imageIds=KNOWN_ACTIVE_IMAGE_ID' | sed -n '1,40p'
curl -sS -i -X POST https://www.imagepartners.kr/api/uploads/presign \
  -H 'Content-Type: application/json' \
  --data '{"filename":"smoke.jpg","contentType":"image/jpeg"}' | sed -n '1,30p'
```

기대 결과:

- `/library`: `200`
- `/api/images?limit=1`: `200` 및 JSON
- `/api/categories`: `200` 및 JSON
- `/api/cart/availability`: `200` 및 활성 이미지가 `purchasableIds`에 포함
- 비로그인 `/api/uploads/presign`: `401`이며 `500`이 아님
- 비로그인 `/api/admin/data-lifecycle-settings`: `403`이며 `500`이 아님

가능하면 브라우저에서 추가로 확인한다.

- 라이브러리 카드와 이미지 상세가 정상 렌더링되는가
- 상세에 `바로 구매하고 원본 다운로드`, 장바구니 추가, 유사 이미지가 표시되는가
- 장바구니에 다른 사진이 있어도 ‘바로 구매’ 체크아웃에는 선택한 한 장만 표시되는가
- 삭제된 이미지는 장바구니에서 제거되고, 기존 주문 이력에서는 썸네일 없이 `Deleted`로 표시되는가
- 로그인한 사진가의 업로드 화면에 최대 20장 안내가 보이는가
- 21장 이상 선택 시 대기열이 20장을 넘지 않고 초과 안내가 표시되는가
- 내 업로드에서 편집 버튼과 제목·설명 저장 동선이 보이는가
- 관리자 `운영정책관리 > 데이터 운영주기 관리`에서 설정 조회·저장이 가능한가

2026-07-14 배포 후 비로그인 브라우저 스모크 테스트에서는 라이브러리 20개 카드, 이미지 상세, 구매·장바구니 버튼, 유사 이미지 4개와 콘솔 오류 0건을 확인했다. 실제 결제 생성, 사진가 편집, 관리자 저장은 인증된 테스트 계정이 필요한 별도 점검 항목이다.

## 8. 실패와 롤백 기준

다음 중 하나면 배포 완료로 보고하지 않는다.

- 새 배포가 Ready 상태가 아님
- 운영 alias가 새 배포를 가리키지 않음
- DB 기반 API가 `500` 또는 연결 오류를 반환함
- 핵심 페이지가 `5xx`를 반환함
- Production 환경 검증이 실패함
- 로컬 HEAD와 원격 브랜치가 일치하지 않음
- 커밋 이후 미커밋 제품 소스가 추가되어 배포 소스를 재현할 수 없음

환경변수는 원인을 확인하기 전에 수정하지 않는다. 이전 정상 배포로 되돌려야 하면 먼저 사용자 승인을 받고 Vercel의 이전 Production deployment를 promote/rollback한다. 롤백 후에도 동일한 스모크 테스트를 반복한다.

## 9. 완료 보고 양식

```text
배포 결과: 성공 / 실패 / 중단
Git branch:
Git commit SHA:
Remote push:
Production deployment ID:
Production URL:
운영 alias:
배포 시각(KST):

검증:
- npm test:
- npm run lint:
- TypeScript:
- npm run build:
- local HEAD = origin branch:
- Production Supabase env:
- /library:
- /api/images?limit=1:
- /api/categories:
- /api/cart/availability:
- /api/uploads/presign 비로그인:
- /api/admin/data-lifecycle-settings 비로그인:

배포된 변경 요약:
남은 위험 또는 후속 작업:
```

기본 명령은 [Vercel Deployment Runbook](./vercel-deployment-runbook.md)을 함께 참고한다.
