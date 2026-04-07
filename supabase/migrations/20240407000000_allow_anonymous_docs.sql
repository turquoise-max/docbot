-- 1. documents 테이블 정책 수정
DROP POLICY IF EXISTS "Users can manage their own documents" ON documents;

CREATE POLICY "Users can manage their own documents" ON documents
FOR ALL USING (
  auth.uid() = user_id OR user_id IS NULL OR
  EXISTS (
    SELECT 1 FROM folders WHERE folders.id = documents.folder_id AND folders.user_id = auth.uid()
  )
);

-- 2. versions 테이블 정책 수정
DROP POLICY IF EXISTS "Users can manage versions for their documents" ON versions;

CREATE POLICY "Users can manage versions for their documents" ON versions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = versions.document_id AND (documents.user_id = auth.uid() OR documents.user_id IS NULL)
  )
);

-- 3. chat_messages 테이블 정책 수정
DROP POLICY IF EXISTS "Users can manage chat messages for their documents" ON chat_messages;

CREATE POLICY "Users can manage chat messages for their documents" ON chat_messages
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = chat_messages.document_id AND (documents.user_id = auth.uid() OR documents.user_id IS NULL)
  )
);