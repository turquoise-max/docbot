-- Add header_html, footer_html, and margins_json columns to documents table
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS header_html text,
ADD COLUMN IF NOT EXISTS footer_html text,
ADD COLUMN IF NOT EXISTS margins_json jsonb;