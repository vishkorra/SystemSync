'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Code2, Download, Upload, RefreshCw, Check, Settings2, X, ChevronDown, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Progress } from "@/components/ui/progress"
import { detectVSCodeSettings, backupVSCode, VSCodeSettings } from "@/lib/vscode"
import { Checkbox } from "@/components/ui/checkbox"
import { formatBytes } from "@/lib/utils"
import { eventEmitter } from "@/lib/events"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

type SettingType = "userData" | "extensions" | "extensionGlobalStorage" | "workspaceStorage" | "application"

export function VSCodeBackup() {
  const [isOpen, setIsOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [settings, setSettings] = useState<VSCodeSettings | null>(null)
  const [selectedSettings, setSelectedSettings] = useState<Set<string>>(
    new Set(['userData', 'extensions', 'extensionGlobalStorage', 'workspaceStorage'])
  )
  const [componentProgress, setComponentProgress] = useState<Record<string, { progress: number; completed: boolean }>>({
    userData: { progress: 0, completed: false },
    extensions: { progress: 0, completed: false },
    extensionGlobalStorage: { progress: 0, completed: false },
    workspaceStorage: { progress: 0, completed: false },
    application: { progress: 0, completed: false }
  })
  const [debugMode, setDebugMode] = useState(false)
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const { toast } = useToast()

  useEffect(() => {
    refreshSettings()
    checkServerStatus()
  }, [])

  const checkServerStatus = async () => {
    setServerStatus('checking')
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch('http://localhost:8001/apps', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        setServerStatus('online')
        console.log('Backend server is online')
      } else {
        setServerStatus('offline')
        console.error(`Server responded with status: ${response.status}`)
        toast({
          title: "Backend Server Issue",
          description: `Server responded with status: ${response.status}. Backup functionality may be limited.`,
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Server check failed:", error)
      setServerStatus('offline')
      
      // Provide more detailed error information for debugging
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      toast({
        title: "Backend Server Unavailable",
        description: `Cannot connect to backend server (${errorMessage}). 
          Some functionality will be limited. 
          The app will operate in demo mode for development purposes.`,
        variant: "destructive"
      })
    }
  }

  const refreshSettings = async () => {
    try {
      setIsRefreshing(true)
      const detected = await detectVSCodeSettings()
      setSettings(detected)
      
      toast({
        title: "Success",
        description: "VSCode settings detected successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to detect VSCode settings",
        variant: "destructive"
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleVSCodeBackup = async () => {
    if (serverStatus === 'offline') {
      toast({
        title: "Backend Server Offline",
        description: "Cannot create backup while the server is offline. Please start the backend server and try again.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsBackingUp(true)
      // Reset all progress
      setComponentProgress(prev => {
        const reset = { ...prev }
        Object.keys(reset).forEach(key => {
          reset[key] = { progress: 0, completed: false }
        })
        return reset
      })
      setProgress(0)

      if (selectedSettings.size === 0) {
        toast({
          title: "Error",
          description: "Please select at least one component to backup",
          variant: "destructive"
        })
        return
      }

      if (debugMode) {
        console.log('Starting backup with selected settings:', Array.from(selectedSettings));
      }

      // Create backup archive
      const backupContent = await backupVSCode(
        (progress, message) => {
          setProgress(progress)
          setProgressMessage(message)
          
          // Update component progress based on the current operation
          if (message.includes('Processing')) {
            const componentMatch = message.match(/Processing ([\w]+)/)
            if (componentMatch) {
              const component = componentMatch[1]
              const percentage = message.includes('%') ? 
                parseInt(message.match(/\((\d+)%\)/)?.[1] || '0') : 
                Math.min(100, progress);
              
              setComponentProgress(prev => ({
                ...prev,
                [component]: { 
                  progress: percentage, 
                  completed: percentage >= 100 
                }
              }))
            }
          } else if (message === 'Backup completed!') {
            // When backup is complete, set all selected components to 100%
            setComponentProgress(prev => {
              const completed = { ...prev }
              selectedSettings.forEach(setting => {
                completed[setting] = { progress: 100, completed: true }
              })
              return completed
            })
          }
        },
        new Set(Array.from(selectedSettings)),
        new Set()
      )

      if (!backupContent) {
        throw new Error('Failed to create backup archive')
      }

      setProgressMessage("Preparing backup file...")
      
      // Create a temporary file with the backup content
      const timestamp = new Date().toISOString()
      const fileName = `vscode-backup-${timestamp}.zip`
      const file = new File([backupContent], fileName, { type: 'application/zip' })

      // Create form data with detailed metadata
      const formData = new FormData()
      formData.append('file', file)
      formData.append('app_name', 'vscode')
      
      // Prepare detailed metadata
      const backupMetadata = {
        timestamp,
        settings: Array.from(selectedSettings).map(setting => {
          const settingData = settings?.[setting as keyof VSCodeSettings]
          return {
            type: setting,
            path: settingData?.path || '',
            size: settingData?.size || 0,
            description: (() => {
              switch (setting) {
                case 'userData': return 'User settings, keybindings, and snippets'
                case 'extensions': return 'VSCode extensions and their data'
                case 'extensionGlobalStorage': return 'Global storage for extensions'
                case 'workspaceStorage': return 'Workspace-specific settings and data'
                case 'application': return 'Complete VSCode application installation'
                default: return ''
              }
            })()
          }
        }).filter(s => s.path && s.size > 0),
        category: 'Development',
        type: 'Application',
        totalSize: Array.from(selectedSettings).reduce((total, setting) => {
          return total + (settings?.[setting as keyof VSCodeSettings]?.size || 0)
        }, 0)
      }
      
      formData.append('metadata', JSON.stringify(backupMetadata))

      setProgressMessage("Uploading backup...")
      
      // Upload the backup if server is available
      try {
        setProgressMessage("Uploading backup to server...")
        
        const response = await fetch('http://localhost:8001/backup', {
          method: 'POST',
          body: formData,
          // Add a timeout to the fetch request
          signal: AbortSignal.timeout(10000) // 10 second timeout
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Backup upload failed: ${response.status} ${response.statusText}. ${errorText}`)
        }
        
        try {
          // Try to parse the response to get the created backup data
          const createdBackup = await response.json()
          console.log('Backup created:', createdBackup)
          
          // Emit event that backup was created so the BackupsList can refresh
          eventEmitter.emit('backup-created', { 
            appName: 'vscode', 
            timestamp: new Date(),
            backup: createdBackup 
          })
        } catch (e) {
          console.warn('Could not parse backup response:', e)
          // Still emit event even if we can't parse the response
          eventEmitter.emit('backup-created', { 
            appName: 'vscode', 
            timestamp: new Date()
          })
        }
      } catch (uploadError) {
        console.error('Error uploading backup:', uploadError)
        
        // Provide a more helpful error message to the user
        let errorMessage = "Failed to upload backup to server. "
        
        if (uploadError instanceof TypeError && uploadError.message.includes('Failed to fetch')) {
          errorMessage += "The backend server appears to be offline or unreachable. "
          errorMessage += "Please ensure the backend server is running at http://localhost:8001"
          
          // In development mode, allow a "demo mode" fallback
          if (process.env.NODE_ENV === 'development') {
            const shouldUseDemo = window.confirm(
              "Backend server is unavailable. Would you like to use demo mode instead? " +
              "This will simulate a successful backup for testing purposes."
            )
            
            if (shouldUseDemo) {
              // Create a fake backup entry for demo purposes
              const demoBackup = {
                id: Date.now(),
                app_name: 'vscode',
                created_at: new Date().toISOString(),
                size: Array.from(selectedSettings).reduce((total, setting) => {
                  return total + (settings?.[setting as keyof VSCodeSettings]?.size || 0)
                }, 0),
                version: 1,
                files: Array.from(selectedSettings),
                filename: `vscode_backup_${Date.now()}.zip`,
                metadata: backupMetadata
              }
              
              // Emit the backup-created event with our demo backup
              eventEmitter.emit('backup-created', { 
                appName: 'vscode', 
                timestamp: new Date(),
                backup: demoBackup
              })
              
              setProgress(100)
              setProgressMessage("Demo backup completed!")
              
              // Set all selected components to 100%
              setComponentProgress(prev => {
                const completed = { ...prev }
                selectedSettings.forEach(setting => {
                  completed[setting as SettingType] = { progress: 100, completed: true }
                })
                return completed
              })
              
              toast({
                title: "Demo Mode",
                description: "Created a simulated backup in demo mode",
              })
              
              setIsBackingUp(false)
              return
            }
          }
        }
        
        toast({
          title: "Upload Error",
          description: errorMessage,
          variant: "destructive"
        })
      }

      setProgress(100)
      setProgressMessage("Backup completed!")
      
      // Set all selected components to 100%
      setComponentProgress(prev => {
        const completed = { ...prev }
        selectedSettings.forEach(setting => {
          completed[setting as SettingType] = { progress: 100, completed: true }
        })
        return completed
      })
    } catch (error: any) {
      console.error('Backup error:', error)
      toast({
        title: "Error",
        description: error.message || "An error occurred during backup",
        variant: "destructive"
      })
    } finally {
      setIsBackingUp(false)
    }
  }

  const toggleSetting = (setting: string): void => {
    setSelectedSettings((prev) => {
      const next = new Set(prev)
      if (next.has(setting)) {
        next.delete(setting)
      } else {
        next.add(setting)
      }
      return next
    })
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Detecting VS Code settings...</span>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg border shadow-sm">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-blue-500" />
            <h3 className="font-semibold">VS Code Backup</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${
                serverStatus === 'online' ? 'bg-green-500' : 
                serverStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'
              }`} />
              <span className="text-xs text-muted-foreground">
                {serverStatus === 'online' ? 'Server Online' : 
                 serverStatus === 'offline' ? 'Server Offline' : 'Checking...'}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              onClick={refreshSettings} 
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Backup your VS Code settings, extensions, and configurations
        </p>
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-3">
          {[
            { id: 'userData', label: 'User Data (Settings, Keybindings)', description: 'User settings, keybindings, and snippets' },
            { id: 'extensions', label: 'Extensions', description: 'VSCode extensions and their data' },
            { id: 'extensionGlobalStorage', label: 'Extension Global Storage', description: 'Global storage for extensions' },
            { id: 'workspaceStorage', label: 'Workspace Storage', description: 'Workspace-specific settings and data' },
            { id: 'application', label: 'VSCode Application', description: 'Complete VSCode application installation' }
          ].map(({ id, label, description }) => (
            <div key={id} className="flex items-start space-x-2 bg-background rounded-md p-2">
              <Checkbox
                id={id}
                checked={selectedSettings.has(id)}
                onCheckedChange={() => toggleSetting(id)}
                disabled={isBackingUp}
                className="mt-1"
              />
              <div className="flex-1">
                <label htmlFor={id} className="flex justify-between text-sm font-medium">
                  <span>{label}</span>
                  <span className="text-muted-foreground">
                    {settings?.[id as keyof VSCodeSettings]?.size 
                      ? formatBytes(settings[id as keyof VSCodeSettings]?.size || 0) 
                      : '0 B'}
                  </span>
                </label>
                <p className="text-xs text-muted-foreground">{description}</p>
                {isBackingUp && selectedSettings.has(id) && (
                  <div className="space-y-1 mt-1">
                    <Progress value={componentProgress[id].progress} className="h-1" />
                    <p className="text-xs text-muted-foreground text-right">
                      {Math.round(componentProgress[id].progress)}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <Button
          className="w-full"
          onClick={handleVSCodeBackup}
          disabled={isBackingUp || serverStatus === 'offline'}
        >
          {isBackingUp ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {progressMessage || 'Creating Backup...'} ({Math.round(progress)}%)
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Backup Selected Components
            </>
          )}
        </Button>

        {isBackingUp && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground text-center">
              {progressMessage || 'Processing files...'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
} 