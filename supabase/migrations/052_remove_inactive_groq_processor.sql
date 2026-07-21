-- Groq was an abandoned fallback experiment and is not an active processor.
-- Keep the published notice aligned with the production Mistral-only path.

update public.legal_documents
set body = replace(
      replace(
        body,
        E'\n- Groq, Inc.: 이미지 분석 실패 시 파일명과 선택적 촬영일시·장소·카메라 정보만으로 보조 메타데이터를 생성합니다. 이미지 파일은 전송하지 않으며 입력·출력은 서비스 안정성 및 오남용 방지를 위해 최대 30일 보관될 수 있습니다.',
        ''
      ),
      E'\n- Groq, Inc. / 미국 / Mistral 분석이 실패하고 보조 분석이 실행될 때 네트워크 전송 / 파일명, 선택적 촬영일시·장소·카메라 정보, 분석 지시문 / 보조 메타데이터 생성 / 최대 30일',
      ''
    ),
    published_at = now(),
    updated_at = now()
where slug = 'privacy';
