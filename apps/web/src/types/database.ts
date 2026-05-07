export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
  app: {
    Tables: {
      site_settings: {
        Row: {
          id: string;
          site_title: string;
          site_subtitle: string;
          hero_description: string | null;
          contact_label: string;
          contact_url: string;
          seed_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          site_title?: string;
          site_subtitle?: string;
          hero_description?: string | null;
          contact_label?: string;
          contact_url?: string;
          seed_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          site_title?: string;
          site_subtitle?: string;
          hero_description?: string | null;
          contact_label?: string;
          contact_url?: string;
          seed_message?: string | null;
          updated_at?: string;
        };
      };
      invite_tokens: {
        Row: {
          id: string;
          email: string | null;
          invite_token: string | null;
          token_hash: string;
          site_role: "owner" | "admin" | "editor" | "publisher" | "viewer";
          expires_at: string;
          used_at: string | null;
          max_uses: number;
          use_count: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email?: string | null;
          invite_token?: string | null;
          token_hash: string;
          site_role?: "owner" | "admin" | "editor" | "publisher" | "viewer";
          expires_at: string;
          used_at?: string | null;
          max_uses?: number;
          use_count?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          email?: string | null;
          invite_token?: string | null;
          token_hash?: string;
          site_role?: "owner" | "admin" | "editor" | "publisher" | "viewer";
          expires_at?: string;
          used_at?: string | null;
          max_uses?: number;
          use_count?: number;
          created_by?: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          site_role: "owner" | "admin" | "editor" | "publisher" | "viewer";
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          site_role?: "owner" | "admin" | "editor" | "publisher" | "viewer";
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          display_name?: string | null;
          site_role?: "owner" | "admin" | "editor" | "publisher" | "viewer";
          status?: string;
          updated_at?: string;
        };
      };
      folders: {
        Row: {
          id: string;
          parent_id: string | null;
          name: string;
          slug: string;
          route_path: string;
          description: string | null;
          hero_note: string | null;
          cover_image_path: string | null;
          access_mode:
            | "inherit"
            | "draft"
            | "public"
            | "share"
            | "login"
            | "private"
            | "specific_users"
            | "group";
          order_index: number;
          accent: "clay" | "sage" | "sky" | "rose";
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          parent_id?: string | null;
          name: string;
          slug: string;
          route_path: string;
          description?: string | null;
          hero_note?: string | null;
          cover_image_path?: string | null;
          access_mode?:
            | "inherit"
            | "draft"
            | "public"
            | "share"
            | "login"
            | "private"
            | "specific_users"
            | "group";
          order_index?: number;
          accent?: "clay" | "sage" | "sky" | "rose";
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          parent_id?: string | null;
          name?: string;
          slug?: string;
          route_path?: string;
          description?: string | null;
          hero_note?: string | null;
          cover_image_path?: string | null;
          access_mode?:
            | "inherit"
            | "draft"
            | "public"
            | "share"
            | "login"
            | "private"
            | "specific_users"
            | "group";
          order_index?: number;
          accent?: "clay" | "sage" | "sky" | "rose";
          updated_by?: string | null;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          folder_id: string | null;
          title: string;
          slug: string;
          route_path: string;
          summary: string | null;
          thumbnail_path: string | null;
          source_type: string;
          render_mode: "site" | "source";
          publish_status: "draft" | "published" | "archived";
          access_mode:
            | "inherit"
            | "draft"
            | "public"
            | "share"
            | "login"
            | "private"
            | "specific_users"
            | "group";
          order_index: number;
          version: number;
          body_html: string;
          rendered_body_html: string;
          author_name: string | null;
          reading_time: string | null;
          is_featured: boolean;
          created_by: string | null;
          updated_by: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          folder_id?: string | null;
          title: string;
          slug: string;
          route_path: string;
          summary?: string | null;
          thumbnail_path?: string | null;
          source_type?: string;
          render_mode?: "site" | "source";
          publish_status?: "draft" | "published" | "archived";
          access_mode?:
            | "inherit"
            | "draft"
            | "public"
            | "share"
            | "login"
            | "private"
            | "specific_users"
            | "group";
          order_index?: number;
          version?: number;
          body_html?: string;
          rendered_body_html?: string;
          author_name?: string | null;
          reading_time?: string | null;
          is_featured?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          folder_id?: string | null;
          title?: string;
          slug?: string;
          route_path?: string;
          summary?: string | null;
          thumbnail_path?: string | null;
          source_type?: string;
          render_mode?: "site" | "source";
          publish_status?: "draft" | "published" | "archived";
          access_mode?:
            | "inherit"
            | "draft"
            | "public"
            | "share"
            | "login"
            | "private"
            | "specific_users"
            | "group";
          order_index?: number;
          version?: number;
          body_html?: string;
          rendered_body_html?: string;
          author_name?: string | null;
          reading_time?: string | null;
          is_featured?: boolean;
          updated_by?: string | null;
          published_at?: string | null;
          updated_at?: string;
        };
      };
      document_assets: {
        Row: {
          id: string;
          document_id: string;
          file_name: string;
          mime_type: string;
          storage_bucket: string;
          storage_path: string;
          public_url: string | null;
          checksum: string | null;
          size_bytes: number | null;
          is_entry: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          file_name: string;
          mime_type: string;
          storage_bucket?: string;
          storage_path: string;
          public_url?: string | null;
          checksum?: string | null;
          size_bytes?: number | null;
          is_entry?: boolean;
          created_at?: string;
        };
        Update: {
          file_name?: string;
          mime_type?: string;
          storage_bucket?: string;
          storage_path?: string;
          public_url?: string | null;
          checksum?: string | null;
          size_bytes?: number | null;
          is_entry?: boolean;
        };
      };
      tags: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
        };
      };
      document_tags: {
        Row: {
          document_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: {
          document_id: string;
          tag_id: string;
          created_at?: string;
        };
        Update: {
          document_id?: string;
          tag_id?: string;
        };
      };
      document_outlines: {
        Row: {
          id: string;
          document_id: string;
          level: number;
          text: string;
          anchor: string;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          level: number;
          text: string;
          anchor: string;
          order_index?: number;
          created_at?: string;
        };
        Update: {
          level?: number;
          text?: string;
          anchor?: string;
          order_index?: number;
        };
      };
      access_grants: {
        Row: {
          id: string;
          target_type: "folder" | "document";
          target_id: string;
          subject_type: string;
          subject_id: string;
          access_level: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          target_type: "folder" | "document";
          target_id: string;
          subject_type: string;
          subject_id: string;
          access_level?: string;
          created_at?: string;
        };
        Update: {
          target_type?: "folder" | "document";
          target_id?: string;
          subject_type?: string;
          subject_id?: string;
          access_level?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          target_type: string;
          target_id: string | null;
          before_payload: Json | null;
          after_payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          target_type: string;
          target_id?: string | null;
          before_payload?: Json | null;
          after_payload?: Json | null;
          created_at?: string;
        };
        Update: {
          actor_id?: string | null;
          action?: string;
          target_type?: string;
          target_id?: string | null;
          before_payload?: Json | null;
          after_payload?: Json | null;
        };
      };
      user_groups: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
        };
      };
      group_members: {
        Row: {
          group_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          group_id: string;
          user_id: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          group_id?: string;
          user_id?: string;
          role?: string;
        };
      };
      ai_suggestions: {
        Row: {
          id: string;
          target_type: "folder" | "document";
          target_id: string;
          suggestion_type: string;
          payload: Json;
          confidence: number | null;
          status: string;
          reviewed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          target_type: "folder" | "document";
          target_id: string;
          suggestion_type: string;
          payload?: Json;
          confidence?: number | null;
          status?: string;
          reviewed_by?: string | null;
          created_at?: string;
        };
        Update: {
          target_type?: "folder" | "document";
          target_id?: string;
          suggestion_type?: string;
          payload?: Json;
          confidence?: number | null;
          status?: string;
          reviewed_by?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      access_mode:
        | "inherit"
        | "draft"
        | "public"
        | "share"
        | "login"
        | "private"
        | "specific_users"
        | "group";
      publish_status: "draft" | "published" | "archived";
      site_role: "owner" | "admin" | "editor" | "publisher" | "viewer";
      target_type: "folder" | "document";
    };
    CompositeTypes: Record<string, never>;
  };
};
