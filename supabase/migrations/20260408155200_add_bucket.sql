-- 1. 'files'라는 이름의 공개(Public) 버킷을 생성합니다.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('files', 'files', true);

-- 2. 누구나 이 버킷에 파일을 업로드하고 다운로드할 수 있도록 권한(RLS Policy)을 부여합니다.
CREATE POLICY "Public Access" ON storage.objects FOR ALL USING (bucket_id = 'files');