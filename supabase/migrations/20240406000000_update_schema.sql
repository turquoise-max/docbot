-- 1. templates 테이블 수정 (기존 내용 유지)
ALTER TABLE templates 
DROP COLUMN IF EXISTS structure,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS html_content TEXT,
ADD COLUMN IF NOT EXISTS file_url TEXT;

-- 2. documents 테이블에 user_id 추가 (문서 생성 에러 해결의 핵심)
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- 3. chat_messages 테이블 수정 (기존 내용 유지)
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS selected_html TEXT,
ADD COLUMN IF NOT EXISTS suggested_html TEXT;

-- 4. 기존 정책들 삭제 후 본인 확인 로직 강화 (re-create)
DROP POLICY IF EXISTS "Users can manage documents in their folders" ON documents;
DROP POLICY IF EXISTS "Users can manage versions for their documents" ON versions;
DROP POLICY IF EXISTS "Users can manage chat messages for their documents" ON chat_messages;

-- 새 정책: 본인 소유(user_id)이거나 본인 폴더에 속한 경우 접근 허용
CREATE POLICY "Users can manage their own documents" ON documents 
FOR ALL USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM folders WHERE folders.id = documents.folder_id AND folders.user_id = auth.uid()
  )
);

-- versions 및 chat_messages도 문서 소유권 기반으로 정책 재설정
CREATE POLICY "Users can manage versions for their documents" ON versions 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM documents 
    WHERE documents.id = versions.document_id AND (documents.user_id = auth.uid())
  )
);

CREATE POLICY "Users can manage chat messages for their documents" ON chat_messages 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM documents 
    WHERE documents.id = chat_messages.document_id AND (documents.user_id = auth.uid())
  )
);