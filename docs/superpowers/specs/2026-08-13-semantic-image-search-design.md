# 의미 기반 이미지 검색 2단계 설계

## 상태와 목표

> 상태: 공급자 선정 전 기반 구현, 운영 비활성

사진으로 검색 1단계의 동일·근접 사진 탐지를 유지하면서, 주제·사물·분위기가 유사한 공개 이미지를 찾을 수 있는 의미 검색 기반을 추가한다. 이번 단계는 공급자를 확정하거나 외부 API를 호출하지 않는다. 스키마, 공급자 계약, 기능 플래그, 혼합 순위와 오프라인 평가 도구까지만 준비한다.

## 확정 경계

- SHA-256·pHash·dHash는 exact 및 가벼운 편집본 판정의 권위 있는 신호로 유지한다.
- 임베딩은 의미 유사도 신호이며 중복 차단·권리 판정·이미지 상태를 바꾸지 않는다.
- 검색 결과는 `approved + active + is_published=true`인 이미지에 한정한다.
- `SEMANTIC_IMAGE_SEARCH_ENABLED`의 기본값은 `false`다. 키나 모델 설정만으로 기능이 켜지지 않는다.
- 공급자와 모델은 아직 확정하지 않는다. 구성 계층은 `voyage`, `nvidia`를 허용하지만 실제 어댑터와 외부 호출은 별도 승인 작업이다.
- 검색 입력은 저장하지 않는다. 외부 공급자 활성화 전 국외 이전, 보유·학습·삭제 정책과 공개 개인정보처리방침을 확정한다.

## 모델 capability와 차원

멀티모달 모델은 입력 지원 범위가 서로 다르므로 공급자 이름만으로 호환성을 가정하지 않는다.

- `imageDocument`: 카탈로그 이미지를 임베딩할 수 있는가
- `imageQuery`: 사용자가 올린 사진을 질의 벡터로 만들 수 있는가
- `textQuery`: 텍스트를 이미지와 같은 공간의 질의 벡터로 만들 수 있는가

사진→사진 의미 검색에는 `imageDocument + imageQuery`가 모두 필요하다. 텍스트→이미지만 지원하는 모델은 향후 텍스트 의미 검색에는 사용할 수 있지만 사진 검색에는 활성화하지 않는다.

모델별 256·512·1024·2048차원 등을 동시에 시험하고 무중단 재색인할 수 있도록 DB 열은 차원을 고정하지 않은 `halfvec`를 사용한다. 각 행에 `dimension`, `provider`, `model`, `model_version`을 저장하며 활성 RPC는 네 값을 모두 일치시킨다. 모델별 ANN 인덱스는 공급자 선정과 카탈로그 규모 측정 후 해당 차원으로 별도 순방향 마이그레이션에서 추가한다. 현재는 감사하기 쉬운 exact cosine KNN을 사용한다.

## 데이터 모델과 상태

`image_semantic_embeddings`는 원본·지문 테이블과 분리한다. 한 이미지에 여러 공급자·모델 버전 행을 허용해 신규 버전을 백필한 뒤 기능 설정만 전환할 수 있게 한다.

- 상태: `pending`, `processing`, `ready`, `failed`, `stale`
- 재현 메타데이터: 공급자, 모델, 모델 버전, 차원, source checksum
- 운영 메타데이터: 시도 횟수, 최근 시도·성공 시각, 오류 코드와 정제된 짧은 오류 설명
- `ready` 행만 검색 대상이며 벡터 실제 차원과 `dimension`이 항상 일치해야 한다.
- 오류 메타데이터에는 이미지, URL, 개인정보, 요청·응답 본문과 공급자 키를 기록하지 않는다.

테이블은 RLS를 켜고 `anon`, `authenticated`의 모든 권한을 회수한다. cosine RPC도 `service_role`만 실행할 수 있다. RPC 내부에서 공개 상태를 다시 검사하고 이미지 ID와 유사도만 반환한다.

## 혼합 순위

1. SHA-256 exact 결과를 항상 최상단에 둔다.
2. 나머지는 cosine 의미 점수와 pHash·dHash 근접 점수를 각각 0~1로 정규화한다.
3. 기본 가중치는 의미 0.8, 지문 0.2이며 존재하는 신호의 가중치만 다시 정규화한다.
4. 점수 동률은 이미지 ID로 안정 정렬하고 최대 20건만 반환한다.

가중치와 임계값은 코드 상수로 시작하되 평가셋 증거 없이 운영에서 조정하지 않는다. 지문 검색 결과가 없더라도 의미 결과를 반환할 수 있으나, exact 결과보다 앞설 수 없다.

## 백필·전환·롤백

1. 새 모델 조합의 행을 `pending`으로 생성한다.
2. 공개 미리보기 파생본을 사용해 비동기 백필하고 각 행을 독립적으로 `ready` 또는 `failed`로 기록한다.
3. 실패 재시도는 멱등이어야 하며 기존 활성 모델 행을 덮어쓰지 않는다.
4. 평가셋과 개인정보 검토를 통과한 모델 조합을 서버 구성에 지정한다.
5. 기능 플래그를 켠 뒤 실패율·지연·무관 결과 비율을 관찰한다.
6. 문제 발생 시 플래그를 끄거나 이전 모델 조합으로 되돌린다. 벡터 삭제나 DB 롤백은 필요하지 않다.

## 품질·운영 승인 게이트

- 대표 질의 최소 50건과 질의별 관련 이미지 정답셋을 버전 관리 가능한 비개인 운영 자산으로 준비한다.
- Recall@10, Precision@10, MRR, nDCG@10, 무관 결과 비율을 공급자·모델별 동일 조건에서 비교한다.
- p95 전체 응답시간, 월 예상 비용, 실패·rate-limit 비율을 기록한다.
- 공급자의 이미지 질의 지원, 입력 보유·학습 사용, 한국 외 처리 위치, 삭제·opt-out 조건을 서면 근거로 확인한다.
- 개인정보처리방침과 위탁·국외 이전 고지를 실제 요청 경로와 일치시킨다.
- 외부 호출 실패 시 기존 지문 검색으로 안전하게 축소하며 업로드·라이브러리 탐색 자체를 막지 않는다.

## 이번 구현의 수용 기준

- 새 순방향 마이그레이션이 pgvector 확장, 다중 모델 임베딩 테이블, RLS, service-role 전용 cosine RPC를 정의한다.
- 기능 플래그는 설정 누락·오류·키 존재와 무관하게 기본 OFF다.
- TypeScript 공급자 계약이 사진 질의, 텍스트 질의, 이미지 문서 capability를 구분한다.
- 혼합 순위에서 exact가 항상 우선하며 점수·제한·동점 정렬이 결정적이다.
- 평가 helper가 Recall@K, Precision@K, MRR, nDCG@K, 무관 결과 비율을 재현 가능하게 계산한다.
- 외부 API 호출, UI 공개, 운영 DB 적용과 카탈로그 백필은 포함하지 않는다.

## 공급자 검토 기록 (2026-08-13)

공급자는 아직 선정하지 않는다. 현재 기능 적합성의 첫 검증 후보는 Voyage이며, NVIDIA는 운영 무료 대안이 아니라 자가 호스팅·데이터 주권과 텍스트→이미지 품질을 비교할 challenger로 둔다.

- Voyage `voyage-multimodal-3.5`는 공식 API에서 text/image query와 text/image document를 모두 지원하므로 사진→사진과 한국어 텍스트→사진 요구를 한 공간에서 시험할 수 있다. 다만 opt-out, 보유·학습 사용, 처리국과 DPA를 서면 확인하고 자체 평가셋을 통과하기 전에는 운영 활성화하지 않는다.
- NVIDIA Build hosted API의 무료 사용은 개발·시험용 trial이며 production 사용 근거가 아니다. 최신 Nemotron VL embedding은 이미지 document와 text query에는 적합하지만 image query는 공식 지원 범위가 아니므로 사진→사진의 직접 대체재로 간주하지 않는다.
- NVIDIA self-host는 데이터가 외부로 나가지 않는 장점이 있지만 GPU, 라이선스, 운영 비용을 합산해야 한다. 구형 NV-CLIP은 공동 image/text 공간을 제공하나 현재 배포 페이지의 deprecated 상태와 제품 데이터셋 품질을 별도로 검증한다.
- 최종 비교는 동일한 비개인 평가셋으로 한국어 text→image와 image→image를 분리해 Recall@10, nDCG@10, MRR, p95 지연, 실패율, 월 비용을 기록한다. 지원하지 않는 capability는 점수 0이 아니라 `unsupported`로 표시한다.

공식 근거: [Voyage multimodal API](https://docs.voyageai.com/reference/multimodal-embeddings-api), [Voyage privacy FAQ](https://docs.voyageai.com/docs/faq), [Voyage Terms](https://www.voyageai.com/tos), [NVIDIA API Trial Terms](https://assets.ngc.nvidia.com/products/api-catalog/legal/NVIDIA%20API%20Trial%20Terms%20of%20Service.pdf), [Nemotron VL NIM reference](https://docs.nvidia.com/nim/nemo-retriever/text-embedding/2.0.0/reference.html), [NV-CLIP deploy status](https://build.nvidia.com/nvidia/nvclip/deploy).
