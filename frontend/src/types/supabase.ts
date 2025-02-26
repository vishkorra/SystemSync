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
      user_settings: {
        Row: {
          id: string
          tier: 'Free' | 'Pro' | 'Premium'
          storage_used: number
          backup_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          tier?: 'Free' | 'Pro' | 'Premium'
          storage_used?: number
          backup_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tier?: 'Free' | 'Pro' | 'Premium'
          storage_used?: number
          backup_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      applications: {
        Row: {
          id: string
          user_id: string
          name: string
          path: string
          category: string
          type: string
          size: number
          settings: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          path: string
          category: string
          type: string
          size: number
          settings?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          path?: string
          category?: string
          type?: string
          size?: number
          settings?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      backups: {
        Row: {
          id: string
          user_id: string
          app_id: string
          filename: string
          storage_path: string
          size: number
          metadata: Json | null
          created_at: string
          restored_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          app_id: string
          filename: string
          storage_path: string
          size: number
          metadata?: Json | null
          created_at?: string
          restored_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          app_id?: string
          filename?: string
          storage_path?: string
          size?: number
          metadata?: Json | null
          created_at?: string
          restored_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 