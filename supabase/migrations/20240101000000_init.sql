-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  workspace_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Folders table
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('공식', '커스텀')),
  industry TEXT,
  is_custom BOOLEAN DEFAULT false,
  html_content TEXT,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table (Pivot to store HTML instead of JSONB blocks)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  current_version INTEGER DEFAULT 1,
  content_html TEXT, -- Storing full HTML including inline styles
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Versions table
CREATE TABLE IF NOT EXISTS versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  snapshot_html TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat Messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  selected_html TEXT,
  suggested_html TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Folders policies
CREATE POLICY "Users can manage their own folders" ON folders FOR ALL USING (auth.uid() = user_id);

-- Templates policies
CREATE POLICY "Anyone can view official templates" ON templates FOR SELECT USING (type = '공식' OR auth.uid() = creator_id);
CREATE POLICY "Users can manage their own custom templates" ON templates FOR ALL USING (auth.uid() = creator_id);

-- Documents policies
CREATE POLICY "Users can manage documents in their folders" ON documents FOR ALL USING (
  EXISTS (
    SELECT 1 FROM folders WHERE folders.id = documents.folder_id AND folders.user_id = auth.uid()
  )
);

-- Versions policies
CREATE POLICY "Users can manage versions for their documents" ON versions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM documents 
    JOIN folders ON documents.folder_id = folders.id 
    WHERE documents.id = versions.document_id AND folders.user_id = auth.uid()
  )
);

-- Chat Messages policies
CREATE POLICY "Users can manage chat messages for their documents" ON chat_messages FOR ALL USING (
  EXISTS (
    SELECT 1 FROM documents 
    JOIN folders ON documents.folder_id = folders.id 
    WHERE documents.id = chat_messages.document_id AND folders.user_id = auth.uid()
  )
);
