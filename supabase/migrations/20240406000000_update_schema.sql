-- Alter templates table
ALTER TABLE templates 
DROP COLUMN IF EXISTS structure,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS html_content TEXT,
ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Create versions table
CREATE TABLE IF NOT EXISTS versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  snapshot_html TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alter chat_messages table
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS selected_html TEXT,
ADD COLUMN IF NOT EXISTS suggested_html TEXT;

-- Enable RLS for versions
ALTER TABLE versions ENABLE ROW LEVEL SECURITY;

-- Versions policies
CREATE POLICY "Users can manage versions for their documents" ON versions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM documents 
    JOIN folders ON documents.folder_id = folders.id 
    WHERE documents.id = versions.document_id AND folders.user_id = auth.uid()
  )
);