# 의미 검색 다중 모델 품질시험 설계

> 상태: 평가 장치 준비, 외부 호출·운영 활성화 전
> 기준일: 2026-08-14

## 목적과 경계

Voyage와 NVIDIA Build/NIM의 검색 품질을 같은 비개인 평가셋으로 비교한다. 현재 사이트가 정식 바이어 제공 전이어도 외부에 전송한 사진의 개인정보·권리·공급자 약관은 그대로 적용된다. 시험에는 얼굴, 차량번호, 주소, 문서, GPS·EXIF 등 식별정보가 없고 평가용 재처리가 허용된 이미지밖에 사용하지 않는다. 실제 사진작가 원본, 비공개 이미지 URL과 구매자 검색 입력은 보내지 않는다.

무료 NVIDIA hosted endpoint는 개발·시험용 Trial로만 사용한다. 평가 결과를 운영 무료 비용이나 SLA로 해석하지 않고 운영 코드·Vercel 환경에는 키와 endpoint를 연결하지 않는다.

## 모델 역할

모든 모델을 한 순위표에 섞지 않고 다음 세 단계로 구분한다.

| 단계 | 후보 | 평가 역할 |
| --- | --- | --- |
| 1차 retrieval | `voyage-multimodal-3.5` | 한국어·영어 text→image, image→image |
| 1차 retrieval | `nvidia/llama-nemotron-embed-vl-1b-v2` | text query→image document만; image query는 `unsupported` |
| 1차 참고군 | `nvidia/nvclip-vit-h-14` | image/text 공동 공간이지만 deprecated이므로 `benchmark-only` |
| 제외 | `nvidia/llama-nemotron-rerank-vl-1b-v2` | 파일럿 약 6.65초로 대화형 검색 1.5초 예산 초과 |
| caption bridge | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | query image를 설명문으로 바꾼 간접 검색 실험 |
| 제외 | `google/gemma-4-31b-it`, `google/gemma-4-26b-a4b-it` | 31B는 약 20.58초, 26B는 hosted 404로 캡션 후보 제외 |
| 제외 | `meta/llama-3.2-90b-vision-instruct` | 60초 timeout으로 캡션·검색 후보 제외 |

`Muse Glimmer 30B`는 NVIDIA 공식 Build/NIM 카탈로그에서 확인되지 않은 이름이므로 등록하지 않는다. 가장 가까운 실제 30B 후보는 Nemotron 3 Nano Omni이며, 이것도 임베딩이 아니라 text/image/video/audio 입력에서 텍스트를 생성하는 VLM이다. Build의 “Image-Text Retrieval” 태그만으로 chat completion 모델을 임베딩으로 간주하지 않는다.

## 평가 자산

- 코퍼스: 비개인·비식별 600~1,000장. 출처, 라이선스, SHA-256을 manifest에 고정한다.
- 전처리: sRGB JPEG, EXIF 제거, 긴 변 1,024px, quality 85. 모든 모델에 동일한 bytes를 보낸다.
- 한국어 text→image: 최소 160질의. 주제 40, 장면·공간관계 30, 분위기 30, 조명·색·스타일 25, 상업 활용·카피스페이스 20, 복합·부정 15.
- 영어 text→image: 한국어 질의의 번역본은 언어 강건성 부록으로 별도 측정한다.
- image→image: 코퍼스와 분리된 seed 40개와 crop·재압축·약한 색·밝기 변형 40개. 의미 검색과 근접 중복 강건성을 분리한다.
- 판정: 모델과 순위를 숨긴 3인이 0~3 등급으로 판정하고 중간값을 사용한다. 큰 불일치는 합의 판정하며 평가자 일치도를 기록한다.

평가 자산에는 원본 이미지나 base64를 Git에 커밋하지 않는다. 공개 가능한 manifest와 판정 JSONL만 버전 관리하고 바이너리는 승인된 별도 평가 저장소에 둔다.

## 점수와 보고

1차 retrieval의 주 지표는 카테고리 macro nDCG@10이다. Recall@10·50, Precision@5, MRR@10, no-relevant@10, p50/p95/p99 지연, 429·실패·재시도율과 실측 비용 단위를 함께 기록한다. 95% bootstrap 신뢰구간을 계산하고 nDCG 차이가 0.02 미만이거나 신뢰구간이 0을 포함하면 실질 동률로 본다.

대화형 검색의 단일 외부 호출 p95 예산은 1.5초, 업로드 후 비동기 캡션의 단일 이미지 p95 예산은 5초다. 예산을 넘거나 endpoint가 가용하지 않은 모델은 품질과 관계없이 `excluded`로 기록하고 평가 runner와 실제 후보 경로에서 호출하지 않는다. 생성형 VLM caption bridge는 직접 검색 품질표에 합치지 않고 caption 오류, 추가 지연과 retrieval 손실을 별도 표시한다. 공식 지원이 없는 track은 `unsupported`, deprecated 모델은 `benchmark-only`, 캡션 경유는 `experimental`로 남긴다.

## 실행 전 게이트

1. `NVIDIA_API_KEY`와 `VOYAGE_API_KEY`는 로컬 비밀 저장소에만 두고 출력·커밋하지 않는다.
2. NVIDIA hosted Nemotron embedding이 image passage를 실제 수용하는지 비개인 이미지 1장으로 smoke-test한다. 공식 hosted reference가 text 입력만 설명하므로 실패하면 self-host NIM 없이 해당 retrieval 시험을 진행하지 않는다.
3. Voyage는 조직 관리자 opt-out, 적용 시각, 보유 정책을 확인한 뒤 opt-out 이후 만든 평가 데이터만 전송한다.
4. 공급자별 model ID, revision, dimension, input type, 전처리 버전과 호출일을 run row에 기록한다.
5. timeout 10초, 최대 2회 지수 재시도를 적용하되 재시도 포함·제외 지연을 모두 남긴다. 요청 본문과 base64는 로그에 남기지 않는다.

현재 로컬 환경에는 두 공급자 키와 승인된 평가 코퍼스가 없어 실제 API 품질시험은 실행하지 않는다. 모델 레지스트리와 오프라인 평가 harness까지만 검증하며, 키·평가 자산이 준비된 뒤 별도 실험 runner와 adapter를 활성화한다.

## 공식 근거

- [Voyage multimodal embeddings](https://docs.voyageai.com/reference/multimodal-embeddings-api)
- [Nemotron VL embedding API](https://docs.nvidia.com/nim/nemo-retriever/text-embedding/2.0.0/reference.html)
- [Nemotron VL reranking API](https://docs.nvidia.com/nim/nemo-retriever/text-reranking/2.0.0/overview.html)
- [Nemotron 3 Nano Omni 30B](https://build.nvidia.com/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning/modelcard)
- [Gemma 4 31B on NVIDIA Build](https://build.nvidia.com/google/gemma-4-31b-it)
- [Llama 3.2 90B Vision Instruct on NVIDIA Build](https://build.nvidia.com/meta/llama-3.2-90b-vision-instruct)
- [NVIDIA API Trial Terms](https://assets.ngc.nvidia.com/products/api-catalog/legal/NVIDIA%20API%20Trial%20Terms%20of%20Service.pdf)
