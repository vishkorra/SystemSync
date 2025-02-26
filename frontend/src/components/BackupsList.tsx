'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Backup } from "@/types"
import { Download, Trash2, Loader2, ChevronDown, FolderOpen } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatBytes } from "@/lib/utils"
import { format } from 'date-fns'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Checkbox } from "@/components/ui/checkbox"
import { getBackups, restoreBackup, deleteBackup, packageVSCode } from "@/lib/api"
import { API_BASE } from "@/lib/api"
import { eventEmitter } from "@/lib/events"
import { restoreVSCode } from "@/lib/vscode"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function BackupsList() {
  const [backups, setBackups] = useState<Record<string, Backup[]>>({})
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Record<number, Set<string>>>({})
  const [expandedBackups, setExpandedBackups] = useState<Set<number>>(new Set())
  const [restoreProgress, setRestoreProgress] = useState(0)
  const [restoreMessage, setRestoreMessage] = useState('')
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const { toast } = useToast()
  const [activeApp, setActiveApp] = useState<string | null>(null)

  useEffect(() => {
    fetchBackups()

    // Listen for backup creation events
    const handleBackupCreated = (data: any) => {
      console.log('Backup created event received:', data)
      fetchBackups()
    }

    // Subscribe to the backup-created event
    eventEmitter.on('backup-created', handleBackupCreated)

    // Cleanup function
    return () => {
      eventEmitter.removeListener('backup-created', handleBackupCreated)
    }
  }, [])

  const fetchBackups = async () => {
    try {
      setLoading(true)
      console.log('Fetching backups...')
      const data = await getBackups()
      
      // Ensure data is not null or undefined
      if (!data) {
        throw new Error('No data returned from server')
      }
      
      console.log('Backups fetched successfully:', data)
      setBackups(data)
      
      // If there are backups, select a tab with content
      const appNames = Object.keys(data)
      if (appNames.length > 0 && appNames.some(app => data[app] && data[app].length > 0)) {
        // Find the first app with backups
        const firstAppWithBackups = appNames.find(app => data[app] && data[app].length > 0)
        if (firstAppWithBackups && firstAppWithBackups !== activeApp) {
          setActiveApp(firstAppWithBackups)
        }
      }
    } catch (error) {
      console.error('Error fetching backups:', error)
      toast({
        title: "Error",
        description: "Failed to fetch backups. Please ensure the backend server is running.",
        variant: "destructive",
      })
      // Set empty backups object to avoid undefined errors
      setBackups({})
    } finally {
      setLoading(false)
    }
  }

  const toggleBackupExpanded = (backupId: number) => {
    setExpandedBackups(prev => {
      const next = new Set(prev)
      if (next.has(backupId)) {
        next.delete(backupId)
      } else {
        next.add(backupId)
      }
      return next
    })
  }

  const toggleFileSelected = (backupId: number, path: string) => {
    setSelectedFiles(prev => {
      const next = { ...prev }
      if (!next[backupId]) {
        next[backupId] = new Set([path])
      } else {
        const files = new Set(next[backupId])
        if (files.has(path)) {
          files.delete(path)
        } else {
          files.add(path)
        }
        next[backupId] = files
      }
      return next
    })
  }

  const handleRestore = async (backup: Backup) => {
    try {
      setRestoring(backup.id)
      
      // For VSCode backups, use the VSCode restore function with progress
      if (backup.app_name && backup.app_name.toLowerCase() === 'vscode') {
        setRestoreProgress(0)
        setRestoreMessage('Preparing to restore...')
        setShowRestoreDialog(true)
        
        try {
          // Get selected components for display purposes only
          const selectedComponents = selectedFiles[backup.id] ? 
            Array.from(selectedFiles[backup.id]) : 
            ['userData', 'extensions', 'workspaceStorage'];
          
          console.log('Restoring VSCode with components:', selectedComponents);
          
          await restoreVSCode(
            backup.id.toString(), 
            (progress, message) => {
              setRestoreProgress(progress)
              setRestoreMessage(message)
            }
          )
          
          toast({
            title: "Success",
            description: `Restored ${backup.app_name} settings`,
          })
        } catch (error) {
          console.error('VSCode restore error:', error)
          toast({
            title: "Error",
            description: `Failed to restore ${backup.app_name} settings`,
            variant: "destructive",
          })
        } finally {
          // Close the dialog after a short delay to show 100%
          setTimeout(() => {
            setShowRestoreDialog(false)
          }, 1000)
        }
      } else {
        // For other backups, use the regular restore function
        const filesToRestore = selectedFiles[backup.id] ? Array.from(selectedFiles[backup.id]) : undefined
        await restoreBackup(backup.id, filesToRestore)
        toast({
          title: "Success",
          description: `Restored ${backup.app_name}${filesToRestore ? ' (selected files)' : ''}`,
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to restore ${backup.app_name}`,
        variant: "destructive",
      })
    } finally {
      setRestoring(null)
    }
  }

  const handleDownload = (backup: Backup) => {
    // Create a direct download link to the backup file
    const downloadUrl = `${API_BASE}/backup/download/${backup.id}`
    
    // Create a temporary anchor element to trigger the download
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = backup.filename || `backup-${backup.id}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    
    toast({
      title: "Download Started",
      description: "Your backup file download has started."
    })
  }

  const handleDownloadPackagedVSCode = async (backupId: number) => {
    const { dismiss } = toast({
      title: "Packaging VS Code",
      description: "Creating a VS Code application with your settings. This may take a few minutes...",
      duration: 120000 // 2 minutes
    });
    
    try {
      // Create a direct download link to the packaged VS Code
      const downloadUrl = `${API_BASE}/backup/${backupId}/package-vscode`;
      
      console.log("Downloading packaged VS Code from:", downloadUrl);
      
      // Check if the endpoint is available
      try {
        const checkResponse = await fetch(`${API_BASE}/backup/${backupId}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });
        
        if (!checkResponse.ok) {
          console.error("Backup check failed:", checkResponse.status, checkResponse.statusText);
          throw new Error(`Backup check failed: ${checkResponse.status} ${checkResponse.statusText}`);
        }
        
        console.log("Backup exists, proceeding with download");
      } catch (checkError) {
        console.error("Error checking backup:", checkError);
        throw new Error("Could not verify backup exists");
      }
      
      // Create a temporary anchor element to trigger the download
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'VSCode_with_Settings.zip';
      a.target = '_blank'; // Open in new tab to avoid blocking
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Dismiss the loading toast
      dismiss();
      
      // Show success message with platform-specific instructions
      const platform = navigator.platform.toLowerCase();
      if (platform.includes('mac')) {
        toast({
          title: "Download Started",
          description: "Your VS Code application is downloading as a DMG file. Once downloaded, open the DMG and drag VS Code to your Applications folder. Your settings and extensions are already included!",
          duration: 10000
        });
      } else if (platform.includes('win')) {
        toast({
          title: "Download Started",
          description: "Your VS Code package is downloading. Once downloaded, extract the ZIP file and follow the instructions in the README file to install.",
          duration: 10000
        });
      } else {
        toast({
          title: "Download Started",
          description: "Your VS Code package is downloading. Once downloaded, extract the archive and follow the instructions for your platform.",
          duration: 10000
        });
      }
    } catch (error) {
      // Dismiss the loading toast
      dismiss();
      
      // Show error message
      console.error('Error downloading VS Code package:', error);
      toast({
        title: "Download Failed",
        description: "There was a problem creating your VS Code package. Please try again later.",
        variant: "destructive",
        duration: 5000
      });
    }
  };

  const handleDelete = async (backup: Backup) => {
    try {
      setDeleting(backup.id)
      await deleteBackup(backup.id)
      await fetchBackups() // Refresh the list
      toast({
        title: "Success",
        description: `Deleted backup of ${backup.app_name}`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to delete backup of ${backup.app_name}`,
        variant: "destructive",
      })
    } finally {
      setDeleting(null)
    }
  }

  const renderBackupFiles = (backup: Backup) => {
    const settings = backup.metadata?.settings || [];
    
    // If settings array is empty, generate default file structure for zip files
    if (settings.length === 0) {
      // For VSCode backups, show typical VSCode structure
      if (backup.app_name && backup.app_name.toLowerCase() === 'vscode') {
        return (
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`${backup.id}-userData`}
                  checked={selectedFiles[backup.id]?.has('userData')}
                  onCheckedChange={() => toggleFileSelected(backup.id, 'userData')}
                />
                <label 
                  htmlFor={`${backup.id}-userData`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  User Data
                </label>
              </div>
              <div className="pl-6 text-sm text-muted-foreground">
                <p className="font-mono text-xs">User settings, keybindings, and snippets</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`${backup.id}-extensions`}
                  checked={selectedFiles[backup.id]?.has('extensions')}
                  onCheckedChange={() => toggleFileSelected(backup.id, 'extensions')}
                />
                <label 
                  htmlFor={`${backup.id}-extensions`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Extensions
                </label>
              </div>
              <div className="pl-6 text-sm text-muted-foreground">
                <p className="font-mono text-xs">VSCode extensions and their data</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`${backup.id}-workspaceStorage`}
                  checked={selectedFiles[backup.id]?.has('workspaceStorage')}
                  onCheckedChange={() => toggleFileSelected(backup.id, 'workspaceStorage')}
                />
                <label 
                  htmlFor={`${backup.id}-workspaceStorage`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Workspace Storage
                </label>
              </div>
              <div className="pl-6 text-sm text-muted-foreground">
                <p className="font-mono text-xs">Workspace-specific settings and data</p>
              </div>
            </div>
          </div>
        );
      }
      
      // For other types of backups, show a generic file structure
      return (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`${backup.id}-all`}
                checked={selectedFiles[backup.id]?.has('all')}
                onCheckedChange={() => toggleFileSelected(backup.id, 'all')}
              />
              <label 
                htmlFor={`${backup.id}-all`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                All Files
              </label>
            </div>
            <div className="pl-6 text-sm text-muted-foreground">
              <p className="font-mono text-xs">Complete backup archive ({formatBytes(backup.size || 0)})</p>
              <p className="mt-1">Contains all backed up files and settings</p>
            </div>
          </div>
        </div>
      );
    }
    
    // If we have actual settings metadata, use that
    return (
      <div className="mt-4 space-y-4">
        {settings.map((setting, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`${backup.id}-${setting.type}`}
                checked={selectedFiles[backup.id]?.has(setting.path)}
                onCheckedChange={() => toggleFileSelected(backup.id, setting.path)}
              />
              <label 
                htmlFor={`${backup.id}-${setting.type}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {setting.type || 'Unknown'}
              </label>
            </div>
            <div className="pl-6 text-sm text-muted-foreground">
              <p className="font-mono text-xs">{setting.path || 'Path not available'}</p>
              {setting.description && (
                <p className="mt-1">{setting.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (Object.keys(backups).length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No backups found
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {Object.entries(backups).map(([appName, appBackups]) => (
        <div key={appName} className="space-y-2">
          <h3 className="font-medium">{appName}</h3>
          <div className="space-y-2">
            {appBackups.map((backup) => (
              <Collapsible
                key={backup.id}
                open={expandedBackups.has(backup.id)}
                onOpenChange={() => toggleBackupExpanded(backup.id)}
              >
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {backup.metadata?.timestamp ? 
                            format(new Date(backup.metadata.timestamp), 'PPp') :
                            format(new Date(backup.created_at || new Date()), 'PPp')
                          }
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Size: {formatBytes(backup.size || 0)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(backup)}
                          disabled={restoring === backup.id}
                        >
                          {restoring === backup.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          Restore {selectedFiles[backup.id]?.size ? 'Selected' : 'All'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(backup)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                        {(backup.app_name && backup.app_name.toLowerCase() === 'vscode') && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleDownloadPackagedVSCode(backup.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download VS Code App
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={deleting === backup.id}
                            >
                              {deleting === backup.id ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <Trash2 className="w-4 h-4 mr-2" />
                              )}
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Backup</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this backup? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(backup)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <ChevronDown className={`h-4 w-4 transition-transform ${expandedBackups.has(backup.id) ? 'rotate-180' : ''}`} />
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>
                  </div>
                </div>
                <CollapsibleContent>
                  <div className="p-4 mt-1 rounded-lg border border-dashed">
                    <div className="flex items-center gap-2 mb-4">
                      <FolderOpen className="w-4 h-4" />
                      <span className="text-sm font-medium">Backup Contents</span>
                    </div>
                    {renderBackupFiles(backup)}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      ))}
      
      {/* Restore Progress Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restoring VSCode Settings</DialogTitle>
            <DialogDescription>
              Please wait while your VSCode settings are being restored...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Progress value={restoreProgress} className="w-full" />
            <p className="text-center text-sm text-muted-foreground">
              {restoreMessage}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 