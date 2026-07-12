# Photographer Batch Upload Design

## Goal

사진작가가 유사한 여러 장의 이미지를 한 번에 선택하고, 공통 메타데이터를 복사한 뒤 파일별 제목, 설명, 태그, 카테고리, 회전값을 조정해 검토 제출할 수 있게 한다.

## Scope

1차 릴리스는 기존 단일 업로드 API를 그대로 재사용한다. 새 DB 테이블이나 bulk API를 만들지 않고, 클라이언트가 선택된 파일을 대기열로 관리한 뒤 `/api/uploads/presign`과 `/api/uploads`를 파일별로 순차 호출한다.

## User Flow

1. 사진작가는 `/dashboard/uploads/new`에서 여러 파일을 드래그하거나 파일 선택 창에서 복수 선택한다.
2. 화면 왼쪽 또는 상단에는 업로드 대기열이 보이고, 현재 편집 중인 파일을 선택할 수 있다.
3. 첫 번째 파일에 AI 분석과 EXIF 자동 입력이 적용되며, 다른 파일도 선택 시 AI/EXIF 분석 결과가 해당 파일의 초안으로 채워진다.
4. 저작권, 무료 사용 정책, 출처, AI/오리지널리티 선언, 사실성 보증은 공통 필드로 입력한다.
5. 제목, 설명, 태그, 카테고리, 촬영일시, 촬영장소, 회전값은 파일별로 편집한다.
6. 제출 시 모든 파일이 순차 업로드된다. 각 파일은 성공, 진행 중, 실패 상태를 가진다.
7. 일부 파일이 실패하면 성공한 파일은 유지되고, 실패 파일은 화면에서 원인을 확인해 다시 제출할 수 있다.

## Architecture

- `src/lib/uploads/batch-client.ts`는 클라이언트 대기열 상태를 다루는 순수 함수를 제공한다.
- `src/app/(dashboard)/dashboard/uploads/new/page.tsx`는 기존 단일 파일 상태를 `UploadDraft[]`와 `activeDraftId` 중심으로 바꾼다.
- 서버 API는 변경하지 않는다. 다중 업로드는 기존 검증, 카테고리 저장, watermark 생성을 그대로 통과한다.

## Data Model

각 업로드 초안은 브라우저 메모리 안에서만 존재한다.

- `id`: 파일명, 크기, 수정 시간을 조합한 안정적 클라이언트 ID
- `file`: 원본 `File`
- `preview`: object URL
- `title`, `description`, `tags`, `categoryCodes`
- `localizedDraft`
- `takenAt`, `location`, `exifData`
- `imgWidth`, `imgHeight`, `rotationDegrees`
- `aiStatus`, `uploadStatus`, `progress`, `error`

공통 필드는 화면 상태로 별도 관리한다.

- `copyrightLicense`
- `freeUsagePolicy`
- `attributionName`
- `attributionUrl`
- `authorshipDeclaration`
- `factualityAgreed`

## Error Handling

- 지원하지 않는 형식이나 500MB 초과 파일은 대기열에 넣지 않고 사용자에게 메시지를 보여준다.
- 업로드 중 한 파일이 실패해도 나머지 파일 처리는 멈추지 않는다.
- 완료 후 실패 파일이 남아 있으면 전체 성공 화면으로 이동하지 않고, 실패 항목만 다시 제출할 수 있게 한다.
- 모든 파일이 성공하면 기존처럼 `/dashboard/uploads`로 이동한다.

## Testing

- 대기열 helper는 중복 파일 제거, 선택 가능 파일 필터링, 공통 필드 적용 가능 여부, 전체 제출 가능 여부를 단위 테스트한다.
- 업로드 화면은 Next 클라이언트 컴포넌트라서 현재 테스트 범위에서는 순수 helper를 중심으로 회귀를 막는다.
- 최종 검증은 `vitest`, `lint`, `tsc`, `next build`, production smoke test로 한다.
