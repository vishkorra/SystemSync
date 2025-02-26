'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBrowserClient } from '@supabase/ssr'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Upload, FileUp } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { eventEmitter } from '@/lib/events'

export function BackupUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()
  const { user } = useAuth()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: 'Error',
        description: 'Please select a file',
        variant: 'destructive',
      })
      return
    }

    try {
      setUploading(true)

      if (!user) throw new Error('Not authenticated')

      // Upload to Supabase Storage
      const timestamp = new Date().toISOString().replace(/[:.]/g, '')
      const filePath = `${user.id}/backup_${timestamp}.zip`

      const { error: uploadError } = await supabase.storage
        .from('backups')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      toast({
        title: 'Success',
        description: 'Backup uploaded successfully',
      })

      // Emit event to notify BackupsList
      eventEmitter.emit('backup-uploaded')

      // Reset form
      setFile(null)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-card rounded-lg border shadow-sm">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <FileUp className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold">Upload Existing Backup</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a previously created backup file (.zip format)
        </p>
      </div>
      
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="backup-file" className="text-sm font-medium">Backup File (ZIP)</Label>
          <Input
            id="backup-file"
            type="file"
            accept=".zip"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-sm"
          />
          {file && (
            <p className="text-xs text-muted-foreground">
              Selected file: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        <Button
          onClick={handleUpload}
          disabled={uploading || !file}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Backup
            </>
          )}
        </Button>
      </div>
    </div>
  )
} 