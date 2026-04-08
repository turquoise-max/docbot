-- documents 테이블에 첫 페이지 테마 여부 컬럼 추가
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS has_title_pg boolean DEFAULT false;