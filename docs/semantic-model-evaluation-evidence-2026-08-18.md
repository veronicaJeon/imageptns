# 의미 검색 다중 모델 연결·파일럿 평가 근거

> 실행일: 2026-08-18
> 상태: 로컬 Trial 연결 검증, 운영 비활성

## 평가 범위

사람·얼굴·문자·식별정보가 없는 합성 이미지로만 실행했다. 코퍼스는 사과, 머그컵, 자전거, 안개 숲, 바다 노을, 빈 주방, 다육식물, 책, 눈길, 추상 종이, 국수, 카메라, 꽃, 콘크리트 건축, 빈 의자, 산정호수 16장이다. image→image 질의는 같은 개념을 다른 구도·조명·개체로 생성한 8장을 사용했다.

평가 바이너리와 전체 run JSON은 `.semantic-evaluation/`에 로컬 전용으로 저장하고 Git에서 제외했다. Git에는 이미지 ID, 비개인 질의와 기대값만 `evals/semantic-smoke-manifest.json`으로 남긴다. 실제 작가 이미지, 사용자 검색 입력, URL, API 키는 사용하거나 기록하지 않았다.

## 연결 결과

| 모델·endpoint | 결과 | 관찰 |
| --- | --- | --- |
| Voyage `voyage-multimodal-3.5`, 512d | 성공 | text query, image document, image query 모두 정상 |
| NVIDIA `llama-nemotron-embed-vl-1b-v2`, 2048d | 성공 | text query와 image passage 정상, image query는 공식 unsupported |
| NVIDIA `llama-nemotron-rerank-vl-1b-v2` | 성공 | 한국어 text query로 16개 image passage 재정렬 |
| NVIDIA `nemotron-3-nano-omni-30b-a3b-reasoning` | 성공 | apple 이미지 단일 라벨 판정 정답, 약 3.39초 |
| NVIDIA Build `google/gemma-4-31b-it` | 성공 | apple 이미지 단일 라벨 판정 정답, 약 20.58초 |
| NVIDIA Build `google/gemma-4-26b-a4b-it` | 실패 | hosted chat endpoint가 404 반환; 현재 카탈로그/API 가용성 재확인 필요 |
| NVIDIA Build `meta/llama-3.2-90b-vision-instruct` | 미완료 | 60초 안에 응답하지 않아 timeout; 검색 보조 모델로는 지연 부담이 큼 |

두 embedding 모델의 단일 text connectivity는 Voyage 약 0.29초, Nemotron 약 0.87초였다. 이는 1회 연결 smoke 값이며 p95나 SLA 근거가 아니다.

Voyage 계정은 결제수단 미등록 상태여서 endpoint가 3 RPM·10K TPM 제한을 직접 반환했다. 4장 batch와 호출 간 21초 간격으로 제한을 준수해 완료했다. NVIDIA hosted embedding은 이미지와 text query batch가 비대칭이어서 image passage와 query를 단건 호출했다. 이 제약을 수동 평가 runner 기본값에 반영했다.

## 파일럿 검색 결과

| 모델 | 한국어 text→image | 영어 text→image | image→image |
| --- | --- | --- | --- |
| Voyage multimodal-3.5 | Top-1 16/16, Recall@5 16/16, MRR 1.0 | Top-1 16/16, Recall@5 16/16, MRR 1.0 | Top-1 8/8, Recall@5 8/8, MRR 1.0 |
| Nemotron Embed VL | Top-1 16/16, Recall@5 16/16, MRR 1.0 | Top-1 16/16, Recall@5 16/16, MRR 1.0 | unsupported |

Nemotron Rerank는 한국어 “나무 테이블 위에 놓인 빨간 사과” 질의에서 사과 이미지를 16장 중 1위로 반환했고 약 6.65초가 걸렸다.

이 파일럿은 서로 매우 다른 단일 주제 16개로 구성돼 두 retriever 모두 만점을 받았다. 따라서 API 연결, 차원, 한국어 기본 정합성과 image-query capability를 확인하는 smoke 근거일 뿐 공급자 품질 우열을 판정하지 않는다. 본선 평가는 설계대로 비개인 600~1,000장, 한국어 160질의, image query 80개와 0~3 관련도 판정을 사용해야 한다.

## 지연 예산에 따른 제외 결정

2026-08-18 제품 결정으로 대화형 검색은 외부 호출 p95 1.5초, 업로드 후 비동기 이미지 캡션은 단일 이미지 p95 5초를 예산으로 둔다.

- Nemotron Rerank VL은 6.65초로 대화형 검색 후보에서 제외한다. 검색은 임베딩 cosine 결과를 직접 반환한다.
- Gemma 4 31B는 20.58초, Llama 3.2 90B Vision은 60초 timeout으로 캡션 후보에서 제외한다.
- Gemma 4 26B는 hosted 404로 제외한다.
- Nemotron Omni 30B는 3.39초로 비동기 캡션 후보에 남기되, 업로드 응답을 기다리게 하지 않고 품질·p95 본선 검증 전 운영 연결하지 않는다.
- Voyage와 Nemotron Embed는 검색 후보로 유지한다. 단일 text smoke가 각각 약 0.29초·0.87초였을 뿐이므로 동시성 조건의 p95 본선은 별도로 측정한다.

제외 모델은 감사 근거에 남지만 모델 레지스트리에서 `excluded`이고 수동 runner도 다시 호출하지 않는다.

## 재실행

키는 `.env.local`에 두고 평가 이미지를 `.semantic-evaluation/corpus`와 `.semantic-evaluation/queries`에 준비한다.

```bash
npm run eval:semantic:smoke
```

비동기 캡션 후보인 Nemotron Omni 호출을 생략하고 retrieval만 재현하려면 다음을 사용한다.

```bash
npm run eval:semantic:smoke -- --skip-generative
```

runner는 요청 본문, base64와 키를 출력하지 않고 상세 결과를 권한 0600의 `.semantic-evaluation/smoke-report.json`에 기록한다. 출력 JSON은 벡터와 이미지가 없는 집계·순위 근거만 포함한다.
