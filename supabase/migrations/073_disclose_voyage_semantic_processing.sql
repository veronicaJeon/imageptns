-- Publish the user-approved Voyage semantic-search processing notice before
-- production indexing or query flags are enabled.

update public.legal_documents
set body = replace(
      replace(
        replace(
          body,
          E'- Mistral AI SAS: 승인된 사진가가 AI 분석을 선택한 경우 업로드 이미지, 파일명, 이미지 메타데이터 및 분석 지시문을 처리합니다. API 입력·출력은 서비스 제공 및 오남용 방지를 위해 최대 30일 보관될 수 있습니다.',
          E'- Mistral AI SAS: 승인된 사진가가 AI 분석을 선택한 경우 업로드 이미지, 파일명, 이미지 메타데이터 및 분석 지시문을 처리합니다. API 입력·출력은 서비스 제공 및 오남용 방지를 위해 최대 30일 보관될 수 있습니다.\n- Voyage AI Innovations, Inc.: 승인·공개된 이미지의 미리보기와 이용자가 입력한 문장 또는 검색용 사진 사본을 의미·분위기 검색용 임베딩으로 변환합니다. 조직의 학습 사용 거부 설정을 적용하며, 해당 설정 이후 전송한 입력은 처리 직후 삭제됩니다. 서비스 사용량·성능 메타데이터에는 입력 내용이 포함되지 않습니다.'
        ),
        E'- Mistral AI SAS / 프랑스 및 유럽연합 / 승인된 사진가가 AI 이미지 분석을 실행할 때 네트워크 전송 / 업로드 이미지, 파일명, 이미지 메타데이터, 분석 지시문 / 이미지 메타데이터 생성 / 최대 30일',
        E'- Mistral AI SAS / 프랑스 및 유럽연합 / 승인된 사진가가 AI 이미지 분석을 실행할 때 네트워크 전송 / 업로드 이미지, 파일명, 이미지 메타데이터, 분석 지시문 / 이미지 메타데이터 생성 / 최대 30일\n- Voyage AI Innovations, Inc. / 미국 및 Voyage AI의 하위처리자 소재국 / 이미지 승인 후 임베딩 생성 또는 이용자가 문장·사진 의미 검색을 실행할 때 네트워크 전송 / 승인·공개 이미지 미리보기, 검색 문장 또는 EXIF·파일명을 제거한 검색용 사진 사본 / 의미·분위기 기반 이미지 검색 / 학습 사용 거부 설정 이후 입력은 처리 직후 삭제'
      ),
      '시행일: 2026년 7월 29일',
      '시행일: 2026년 8월 21일'
    ),
    published_at = now(),
    updated_at = now()
where slug = 'privacy'
  and body not like '%Voyage AI Innovations, Inc.%';
