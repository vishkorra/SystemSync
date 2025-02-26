export type Category = 'Development' | 'Gaming' | 'Productivity' | 'Creative' | 'System' | 'Other'

export type Tier = 'Free' | 'Pro' | 'Premium'

export interface App {
  id: number
  name: string
  path: string
  category: Category
  type: string
  size: number
  settings: AppSetting[]
  created_at: string
  updated_at: string
}

export interface AppSetting {
  path: string
  type: string
  description?: string
}

export interface Backup {
  id: number
  app_name: string
  filename: string
  storage_path?: string
  size: number
  metadata?: {
    timestamp: string
    settings: AppSetting[]
  }
  created_at: string
  restored_at?: string | null
  version?: number
  files?: string[]
}

export interface BackupProgress {
  current: number
  details: string
}

export interface TierLimit {
  maxBackupSize: number // in bytes
  maxApps: number
  retentionDays: number
  features: string[]
} 