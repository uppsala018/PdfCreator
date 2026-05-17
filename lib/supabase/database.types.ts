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
      projects: {
        Row: {
          id: string
          user_id: string
          title: string
          subtitle: string | null
          author: string | null
          website: string | null
          theme: string
          template: string
          content: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          subtitle?: string | null
          author?: string | null
          website?: string | null
          theme?: string
          template?: string
          content?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          subtitle?: string | null
          author?: string | null
          website?: string | null
          theme?: string
          template?: string
          content?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      exports: {
        Row: {
          id: string
          project_id: string
          user_id: string
          file_path: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          file_path?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          file_path?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          ai_provider: string | null
          ai_default_provider: string | null
          ai_default_model: string | null
          anthropic_key: string | null
          anthropic_model: string | null
          anthropic_models: string | null
          openai_key: string | null
          openai_model: string | null
          openai_models: string | null
          openrouter_key: string | null
          openrouter_api_key: string | null
          openrouter_model: string | null
          openrouter_models: string | null
          gemini_key: string | null
          gemini_api_key: string | null
          gemini_model: string | null
          gemini_models: string | null
          mistral_key: string | null
          mistral_api_key: string | null
          mistral_model: string | null
          mistral_models: string | null
          custom_provider_name: string | null
          custom_api_key: string | null
          custom_base_url: string | null
          custom_model: string | null
          custom_compatibility: string | null
          custom_ai_key: string | null
          custom_ai_base_url: string | null
          custom_ai_model: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          ai_provider?: string | null
          ai_default_provider?: string | null
          ai_default_model?: string | null
          anthropic_key?: string | null
          anthropic_model?: string | null
          anthropic_models?: string | null
          openai_key?: string | null
          openai_model?: string | null
          openai_models?: string | null
          openrouter_key?: string | null
          openrouter_api_key?: string | null
          openrouter_model?: string | null
          openrouter_models?: string | null
          gemini_key?: string | null
          gemini_api_key?: string | null
          gemini_model?: string | null
          gemini_models?: string | null
          mistral_key?: string | null
          mistral_api_key?: string | null
          mistral_model?: string | null
          mistral_models?: string | null
          custom_provider_name?: string | null
          custom_api_key?: string | null
          custom_base_url?: string | null
          custom_model?: string | null
          custom_compatibility?: string | null
          custom_ai_key?: string | null
          custom_ai_base_url?: string | null
          custom_ai_model?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          ai_provider?: string | null
          ai_default_provider?: string | null
          ai_default_model?: string | null
          anthropic_key?: string | null
          anthropic_model?: string | null
          anthropic_models?: string | null
          openai_key?: string | null
          openai_model?: string | null
          openai_models?: string | null
          openrouter_key?: string | null
          openrouter_api_key?: string | null
          openrouter_model?: string | null
          openrouter_models?: string | null
          gemini_key?: string | null
          gemini_api_key?: string | null
          gemini_model?: string | null
          gemini_models?: string | null
          mistral_key?: string | null
          mistral_api_key?: string | null
          mistral_model?: string | null
          mistral_models?: string | null
          custom_provider_name?: string | null
          custom_api_key?: string | null
          custom_base_url?: string | null
          custom_model?: string | null
          custom_compatibility?: string | null
          custom_ai_key?: string | null
          custom_ai_base_url?: string | null
          custom_ai_model?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }  // end Tables
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Convenience aliases so the rest of the app doesn't need to repeat the path.
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]
