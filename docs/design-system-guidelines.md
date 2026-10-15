# Image Partners Design System Guidelines

> 상태: 기준
> 갱신일: 2026-10-15

## Product interface direction

- Image Partners의 Epilogue·Inter 글꼴, 브랜드 녹색, 사진 중심 정체성을 유지한다. 참고 서비스의 상표·고유 문구·아이콘·이미지·수치 토큰을 복제하지 않고 정보 위계와 상호작용 원리만 내재화한다.
- 공개 화면은 `content-shell`(일반 콘텐츠 1,200px), `reading-shell`(공지·문서 840px), 라이브러리 갤러리(최대 1,680px)를 기준으로 한다. 관리자와 대시보드는 1,500px 이내의 밀도 높은 작업 화면을 기본으로 한다.
- 화면마다 새로운 카드 문법을 만들지 않는다. 경계·배경·그림자는 `ui-surface`, 입력은 `ui-field`, 행은 `ui-list-row`를 우선 사용한다.
- 한 영역의 CTA는 주 행동 하나와 보조 행동 하나를 기본 상한으로 삼는다. 모바일 CTA는 필요할 때 전체 너비, 데스크톱 CTA는 내용 너비 또는 동일 카드의 정렬된 전체 너비를 사용한다.

## Button and CTA policy

- 공용 높이는 small 36px, medium 44px, large 56px이다. primary, secondary, tertiary, danger, ghost, icon 계층을 유지한다.
- primary는 브랜드 녹색과 흰 글자, secondary는 밝은 표면과 테두리, tertiary는 낮은 표면, danger는 오류 색을 사용한다.
- hover는 색 대비, 1px 이내의 위 이동, 얕은 그림자만 사용한다. 카드나 버튼을 과도하게 확대하지 않는다. active에서는 이동을 원점으로 되돌린다.
- 링크형 CTA도 버튼과 같은 높이·모서리·포커스 규칙을 적용한다.

## Search, filter, and result policy

- 검색 입력과 가장 중요한 정렬·방향 조건은 한 줄의 주 제어 영역으로 유지한다. 부가 필터는 접을 수 있지만 검색 자체를 숨기지 않는다.
- 검색 결과 수, 적용된 조건 수, 전체 해제를 가까운 위치에 둔다. 무결과는 오류와 구분하며 조건 해제·카테고리 탐색·이미지 요청의 다음 행동을 제공한다.
- 가로 스크롤 카테고리는 항목이 많아져도 첫 항목을 왼쪽 기준으로 유지한다. 콘텐츠 폭을 늘리고 오른쪽으로 스크롤하며, 중앙 정렬 때문에 왼쪽 항목이 잘리면 안 된다.

## List, accordion, and card policy

- 공지·FAQ는 행 전체가 hover에 반응하며, 제목·날짜·상태 메타데이터의 위계를 유지한다. 본문은 같은 행 안에서 280ms 이하로 확장한다.
- 아코디언은 네이티브 `details`/`summary` 의미 구조를 기본으로 하며 키보드 조작과 포커스 표시를 유지한다.
- 비교 카드의 이미지·제목·설명·기능 목록·CTA 순서를 통일하고 CTA 기준선을 맞춘다. 갤러리 이미지는 콘텐츠보다 강한 장식을 피하고 hover 확대를 1.5% 이내로 제한한다.

## Dialog and overlay policy

- 새 팝업은 `Dialog` 또는 `ui-modal-backdrop`·`ui-modal-panel`을 사용한다. 데스크톱은 중앙 dialog, 모바일은 화면 아래에서 올라오는 sheet 비율을 사용한다.
- 공통 스크림, 24px 모서리, 헤더·스크롤 본문·선택적 footer 구조를 유지한다. 큰 미리보기는 최대 1,440px를 사용해 원래 화면 비율을 확보한다.
- dialog는 `role="dialog"`, `aria-modal="true"`, 접근 가능한 제목을 가진다. 공용 `Dialog`는 ESC 닫기, 포커스 순환·복귀, 배경 스크롤 잠금을 제공한다.

## Motion and accessibility

- 빠른 피드백 140ms, 표준 전환 200ms, sheet·accordion 280ms를 기본으로 하고 표준·강조 easing 토큰을 사용한다.
- 키보드 포커스는 브랜드색의 3px 외곽선으로 표시한다. 마우스 사용 여부와 관계없이 포커스를 색 변화만으로 표현하지 않는다.
- `prefers-reduced-motion: reduce`에서는 애니메이션과 부드러운 스크롤 시간을 사실상 제거한다.
- 터치 대상은 원칙적으로 40px 이상, 주요 행동은 44px 이상을 확보한다.

## Responsive acceptance

- 360px, 768px, 1024px, 1440px에서 가로 넘침, 고정 내비게이션 가림, 팝업 본문 접근, CTA 줄바꿈을 확인한다.
- 라이트·다크 모드 모두에서 본문, 경계, 선택 상태, 스크림 위 dialog 대비를 확인한다.
- 기능 변경 없이 시각 체계를 바꾸는 경우에도 타입 검사, 린트, 전체 테스트, 프로덕션 빌드를 통과해야 한다.

## Navigation emphasis and hover policy

- Priority navigation items may use the brand primary color without adding a persistent filled background that could be mistaken for a selected state.
- Hover feedback for a priority action must increase perceived brightness or contrast. Do not darken the brand color by lowering opacity.
- Use the `primary-highlight` color token for brighter brand hover states. In light mode it is a clearer, brighter green than `primary`; in dark mode it advances to the high-luminance brand accent.
- Supporting copy must remain visually subordinate to the menu label through smaller type and lighter weight, while changing to the same highlight family on hover.
- Mobile and desktop variants must preserve the same interaction meaning even when their layouts differ.

## Collapsible search and filter panels

- Keep the primary search row visible when secondary filters are collapsed.
- Place the collapse/expand control at the far right of the primary search row and expose its state with `aria-expanded`, an accessible label, and a tooltip title.
- Collapse category and usage-condition rows as one secondary-filter group so their information hierarchy remains intact.
- Animate height and opacity together, and clip collapsed content to prevent focusable or visible remnants.
- Default to expanded for new users. Persist an explicit user preference locally so returning to the library restores the last chosen state.

## Admin data list policy

- Simple metrics and metadata must default to inline typography, not filled containers. Prefer patterns such as `Views 0 · Sales 0` over separate gray boxes for each value.
- Status values must use compact chips with a shared height, border, and tone scale. Keep related states inline with the record title or row header whenever possible.
- Action buttons must communicate hierarchy consistently: primary for the most common task, secondary for supporting inspection or navigation, and danger for destructive or irreversible actions.
- Data-heavy admin screens should use a bounded page width and either a dense table or a responsive record list. Avoid cards that stretch uncomfortably when there are few results or create excessive vertical bulk when there are many.
- Admin screens should use the shared primitives in `src/components/admin/AdminPrimitives.tsx` before adding page-local badge, button, metric, or list-surface styles.

## Dashboard summary policy

- Dashboard overview metrics should be grouped into a single compact strip or slim summary card, not separated into large independent statistic boxes.
- Primary metric values should rely on typographic hierarchy and small icon color accents. Avoid heavy borders or filled backgrounds around each individual number.
- Recent activity rows should align thumbnail, title, date, and status chips in a dense row on desktop, with compact stacked fallbacks on narrow screens.
- Secondary financial metrics should be grouped as a key-value list or compact table instead of separate statistic cards.
