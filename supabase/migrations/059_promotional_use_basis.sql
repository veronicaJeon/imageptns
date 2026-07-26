-- IMAGE PARTNERS - Promotional-use eligibility basis and owner-approved backfill

alter table public.images
  add column if not exists promotional_use_basis text;

alter table public.images
  drop constraint if exists images_promotional_use_basis_check;

alter table public.images
  add constraint images_promotional_use_basis_check
  check (
    promotional_use_basis is null
    or promotional_use_basis in ('explicit', 'free_all', 'cc0', 'cc_by', 'owner_backfill')
  );

comment on column public.images.promotional_use_basis is
  'Why promotional display is allowed: explicit consent, license/policy automation, or owner-confirmed legacy backfill.';

-- The project owner confirmed that all images uploaded before this migration
-- are owner-controlled and may be used for Image Partners promotion.
update public.images
set promotional_use_allowed = true,
    promotional_use_consented_at = coalesce(promotional_use_consented_at, now()),
    promotional_use_consent_version = '2026-07-27-v2',
    promotional_use_revoked_at = null,
    promotional_use_basis = 'owner_backfill',
    updated_at = now();

update public.legal_documents
set body = replace(
      replace(
        body,
        '시행일: 2026년 7월 21일',
        '시행일: 2026년 7월 27일'
      ),
      '제5조 사진가와 업로드 콘텐츠
사진가는 자신이 업로드하는 이미지와 메타데이터를 등록·공개·라이선스할 적법한 권한을 보유해야 합니다. 필요한 초상권, 재산권, 상표권, 촬영 허가 및 모델·프로퍼티 릴리즈를 확보해야 하며, 에디토리얼 전용 또는 AI 생성·보정 여부를 정확히 표시해야 합니다. 서비스는 권리 침해 우려, 부정확한 정보, 품질 기준 미달 또는 법령 위반 가능성이 있는 콘텐츠를 비공개·반려·삭제하고 자료 제출을 요청할 수 있습니다.',
      '제5조 사진가와 업로드 콘텐츠
사진가는 자신이 업로드하는 이미지와 메타데이터를 등록·공개·라이선스할 적법한 권한을 보유해야 합니다. 필요한 초상권, 재산권, 상표권, 촬영 허가 및 모델·프로퍼티 릴리즈를 확보해야 하며, 에디토리얼 전용 또는 AI 생성·보정 여부를 정확히 표시해야 합니다. 사진가가 ‘전체 무료’, CC0 또는 CC BY 4.0을 선택하면 해당 조건에 따라 이미지파트너스의 회사소개·서비스 안내·공식 홍보에 메타데이터를 제거한 저해상도 전시용 파생본을 사용하는 범위가 포함됩니다. 그 밖의 라이선스는 사진가가 별도로 홍보 활용을 허용한 경우에만 사용합니다. 홍보 활용 허용을 철회하면 서비스는 향후 사용을 중단하고 관리 중인 전시본을 회사소개 등에서 분리합니다. 서비스는 권리 침해 우려, 부정확한 정보, 품질 기준 미달 또는 법령 위반 가능성이 있는 콘텐츠를 비공개·반려·삭제하고 자료 제출을 요청할 수 있습니다.'
    ),
    updated_at = now()
where slug = 'terms';

update public.legal_documents
set body = replace(
      replace(
        body,
        '시행일: 2026년 7월 21일',
        '시행일: 2026년 7월 27일'
      ),
      '5. 무료 사용 정책
‘무료 사용 가능’ 또는 ‘교육용 무료’ 표시는 가격 정책을 뜻하며 저작권 포기나 무제한 이용을 뜻하지 않습니다. 이미지별 저작권 등급, 사용 목적, 출처 표시, 변경 허용 여부를 함께 확인해야 합니다.',
      '5. 무료 사용 및 서비스 홍보 정책
‘전체 무료’를 선택하면 플랫폼 방문자의 무료 사용과 함께 이미지파트너스의 회사소개·서비스 안내·공식 홍보에 저해상도 전시용 파생본을 사용하는 범위가 포함됩니다. CC0와 CC BY 4.0 이미지도 각 공개 라이선스 조건에 따라 홍보 활용 대상이 되며, CC BY 이미지는 사진가와 라이선스를 표시합니다. ‘교육용 무료’는 교육 목적 무료 이용만 뜻하므로 서비스 홍보 활용은 별도 허용이 필요합니다. 무료 표시는 저작권 포기나 모든 제한의 소멸을 뜻하지 않으며 이미지별 출처 표시, 상업 이용, 변경 허용 조건을 함께 확인해야 합니다.'
    ),
    updated_at = now()
where slug = 'license_guide';
