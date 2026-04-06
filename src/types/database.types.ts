export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          display_name: string | null
          workspace_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          display_name?: string | null
          workspace_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          workspace_id?: string | null
          created_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          folder_id: string | null
          template_id: string | null
          title: string
          status: string | null
          current_version: number | null
          content_html: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          folder_id?: string | null
          template_id?: string | null
          title: string
          status?: string | null
          current_version?: number | null
          content_html?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          folder_id?: string | null
          template_id?: string | null
          title?: string
          status?: string | null
          current_version?: number | null
          content_html?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      templates: {
        Row: {
          id: string
          creator_id: string | null
          title: string
          type: string
          industry: string | null
          is_custom: boolean | null
          html_content: string | null
          file_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          creator_id?: string | null
          title: string
          type: string
          industry?: string | null
          is_custom?: boolean | null
          html_content?: string | null
          file_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          creator_id?: string | null
          title?: string
          type?: string
          industry?: string | null
          is_custom?: boolean | null
          html_content?: string | null
          file_url?: string | null
          created_at?: string
        }
      }
      versions: {
        Row: {
          id: string
          document_id: string
          created_at: string
          snapshot_html: string | null
        }
        Insert: {
          id?: string
          document_id: string
          created_at?: string
          snapshot_html?: string | null
        }
        Update: {
          id?: string
          document_id?: string
          created_at?: string
          snapshot_html?: string | null
        }
      }
      folders: {
        Row: {
          id: string
          user_id: string | null
          name: string
          parent_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          parent_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          parent_id?: string | null
          created_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          document_id: string
          role: string
          content: string
          created_at: string
          selected_html: string | null
          suggested_html: string | null
        }
        Insert: {
          id?: string
          document_id: string
          role: string
          content: string
          created_at?: string
          selected_html?: string | null
          suggested_html?: string | null
        }
        Update: {
          id?: string
          document_id?: string
          role?: string
          content?: string
          created_at?: string
          selected_html?: string | null
          suggested_html?: string | null
        }
      }
    }
  }
}