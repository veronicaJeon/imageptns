-- ─────────────────────────────────────────────
-- Image Partners — 개발용 초기 데이터 (seed)
-- ─────────────────────────────────────────────

-- 개발 시 테스트 카테고리
INSERT INTO categories (slug, name_ko, name_en) VALUES
  ('nature',       '자연',     'Nature'),
  ('people',       '인물',     'People'),
  ('editorial',    '에디토리얼', 'Editorial'),
  ('urban',        '도시',     'Urban'),
  ('abstract',     '추상',     'Abstract'),
  ('architecture', '건축',     'Architecture')
ON CONFLICT (slug) DO NOTHING;
