-- Align published legal documents with immutable checkout consent records.

update public.legal_documents
set body = replace(
      body,
      '주문자 이름·이메일, 주문번호, 상품·라이선스·금액, 주문·입금확인·취소·환불·다운로드 및 증빙 발급 기록.',
      '주문자 이름·이메일, 주문번호, 상품·라이선스·금액, 주문 당시 약관·라이선스·취소환불 정책과 동의 버전·시각, 입금확인·취소·환불·다운로드 및 증빙 발급 기록.'
    ),
    updated_at = now(),
    published_at = now()
where slug = 'privacy';

update public.legal_documents
set body = replace(
      body,
      '가격, 제공 시점, 취소·환불 및 증빙 조건은 주문 화면과 사업자정보·거래조건 화면에 안내합니다. 온라인 카드결제와 온체인 결제는 별도 공개 전까지 제공하지 않습니다.',
      '가격, 제공 시점, 취소·환불 및 증빙 조건은 주문 화면과 사업자정보·거래조건 화면에 안내합니다. 회원은 주문 제출 전에 주문 내용, 라이선스 조건과 취소·환불 정책을 확인하고 동의해야 하며, 서비스는 주문 당시 고지·동의 내용과 시각을 거래기록으로 보존합니다. 온라인 카드결제와 온체인 결제는 별도 공개 전까지 제공하지 않습니다.'
    ),
    updated_at = now(),
    published_at = now()
where slug = 'terms';
