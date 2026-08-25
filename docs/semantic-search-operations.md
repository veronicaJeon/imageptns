# 의미 검색 운영 절차

> 기준일: 2026-08-21

## 활성화 순서

1. Voyage 결제수단과 조직 관리자 학습 사용 거부가 적용됐는지 확인한다.
2. 개인정보처리방침의 Voyage 위탁·국외 이전 고지를 먼저 게시한다.
3. 마이그레이션 069~074를 적용한다. `images-analysis` 버킷은 비공개이며 공개·authenticated 읽기 정책이 없어야 한다.
4. 의미 검색 공급자를 `voyage`, 모델을 `voyage-multimodal-3.5`, 버전을 `provider-managed`, 차원을 `512`로 설정한다.
5. 인덱싱만 먼저 켜고 `/api/cron/semantic-indexing` 또는 관리자 전용 `/api/admin/semantic-indexing`을 1회 실행한다.
6. 관리자 상태는 현재 `analysis-v1` 입력 버전의 `ready`, `failed`, `stale`만 집계한다. 첫 기존 이미지 처리에서 비공개 원본으로 `images-analysis` 사본이 생성되는지 확인한다.
7. ready 행이 생긴 뒤 의미 질의를 켜고 비개인 문장·사진으로 스모크 테스트한다.

예약 작업은 매일 최대 3개의 누락 승인 이미지를 등록하고 순차 처리한다. 새 이미지는 관리자 승인 시 즉시 `pending`으로 등록된다. 업로드·반려·취소 시점에는 외부 공급자를 호출하지 않는다.
초기 백필은 관리자 전용 endpoint를 반복 호출해 제한된 배치로 앞당길 수 있으며, 응답과 상태 조회에는 이미지 ID·경로·공급자 원문 오류를 포함하지 않는다.

카탈로그 임베딩과 NVIDIA 캡션은 공개 워터마크 미리보기를 사용하지 않는다. 신규 업로드는 방향 보정·EXIF 제거·긴 변 1,600px 축소를 거친 `analysis-v1` JPEG를 먼저 만들고, 기존 승인 이미지는 새 버전 작업을 처음 처리할 때 비공개 원본에서 같은 사본을 지연 생성한다. 사본 생성 실패는 외부 공급자 호출 전에 작업 실패로 기록한다. 입력 파이프라인 버전은 공급자 모델 버전 뒤 `+analysis-v1`로 구분하므로 이전 벡터를 삭제하지 않고 롤백할 수 있다.

## 검색 정책

- 문장: 제목·태그의 강한 키워드 결과를 우선하고, 없을 때만 Voyage 문장 임베딩을 요청한다.
- 사진: exact·pHash·dHash 후보를 우선하고, 없을 때만 EXIF·파일명을 제거한 1024px JPEG 사본으로 Voyage image query를 요청한다.
- 의미 유사도가 설정 임계값 미만이면 결과를 제공하지 않는다.
- Voyage 오류·시간초과·rate limit이면 약한 결과로 채우지 않고 빈 결과를 반환한다.

## 중단과 롤백

- 신규 임베딩 생성 중단: `SEMANTIC_IMAGE_INDEXING_ENABLED=false`
- 의미 질의 중단: `SEMANTIC_IMAGE_QUERY_ENABLED=false`
- 전체 중단: `SEMANTIC_IMAGE_SEARCH_ENABLED=false`

플래그를 끄면 기존 벡터는 서버 전용 테이블에 남지만 검색 결과에는 사용되지 않는다. 롤백 과정에서 테이블이나 벡터를 삭제하지 않는다.
코드 롤백 시 `images-analysis` 파일과 `storage_path_analysis` 메타데이터는 삭제하지 않는다. 이전 공급자 모델 버전의 벡터를 다시 선택할 수 있으며, 분석 사본 정리는 별도 승인된 완전삭제 절차로만 수행한다.

## NVIDIA 캡션

NVIDIA 캡션은 사진작가 입력을 덮어쓰지 않고 별도 서버 전용 보조 캡션으로 저장하며 키워드 검색 B 가중치에만 추가한다. Build 무료 endpoint는 평가 전용이므로 운영 구독 또는 self-host 권한을 확인한 뒤에만 `NVIDIA_API_PRODUCTION_ENTITLED=true`와 `NVIDIA_CAPTIONING_ENABLED=true`를 함께 설정한다. 둘 중 하나라도 없으면 실제 이미지를 NVIDIA로 보내지 않는다.
