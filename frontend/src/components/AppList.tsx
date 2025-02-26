'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Upload, Loader2, ChevronDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { SearchAndFilter } from "./SearchAndFilter"
import { App, Category, BackupProgress } from "@/types"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { formatBytes } from "@/lib/utils"
import { getApplications, createBackup, getBackupProgress } from "@/lib/api"

export function AppList() {
  const [apps, setApps] = useState<App[]>([])
  const [filteredApps, setFilteredApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)
  const [backingUp, setBackingUp] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([])
  const [progress, setProgress] = useState<Record<string, BackupProgress>>({})
  const { toast } = useToast()

  useEffect(() => {
    fetchApps()
  }, [])

  useEffect(() => {
    filterApps()
  }, [apps, searchTerm, selectedCategories])

  const fetchApps = async () => {
    try {
      const data = await getApplications()
      setApps(data)
      setLoading(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch applications",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  const filterApps = () => {
    let filtered = [...apps]
    
    if (searchTerm) {
      filtered = filtered.filter(app => 
        app.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(app => 
        selectedCategories.includes(app.category)
      )
    }
    
    setFilteredApps(filtered)
  }

  const handleBackup = async (app: App) => {
    try {
      setBackingUp(app.name)
      setProgress(prev => ({
        ...prev,
        [app.name]: { current: 0, details: "Starting backup..." }
      }))

      // Start the backup
      await createBackup(app.name)

      // Poll for progress
      const pollProgress = async () => {
        try {
          const progressData = await getBackupProgress(app.name)
          
          if (progressData.status === "completed") {
            setProgress(prev => ({
              ...prev,
              [app.name]: { current: 100, details: "Backup completed" }
            }))
            setBackingUp(null)
            toast({
              title: "Success",
              description: `Backup completed for ${app.name}`,
            })
            
            // Emit event that backup was created so the BackupsList can refresh
            import('@/lib/events').then(({ eventEmitter }) => {
              eventEmitter.emit('backup-created', { appName: app.name, timestamp: new Date() })
            })
            
            return
          }

          if (progressData.status === "failed") {
            setProgress(prev => ({
              ...prev,
              [app.name]: { current: 0, details: "Backup failed" }
            }))
            setBackingUp(null)
            toast({
              title: "Error",
              description: `Backup failed for ${app.name}`,
              variant: "destructive"
            })
            return
          }

          // Update progress
          setProgress(prev => ({
            ...prev,
            [app.name]: { 
              current: progressData.progress, 
              details: progressData.status
            }
          }))

          // Continue polling if not complete
          setTimeout(pollProgress, 500)
        } catch (error) {
          console.error("Error polling progress:", error)
          setBackingUp(null)
          toast({
            title: "Error",
            description: "Failed to get backup progress",
            variant: "destructive"
          })
        }
      }

      // Start polling
      pollProgress()
    } catch (error) {
      setBackingUp(null)
      console.error("Error creating backup:", error)
      toast({
        title: "Error",
        description: "Failed to start backup",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <SearchAndFilter
        onSearch={setSearchTerm}
        onCategoryChange={setSelectedCategories}
      />
      <div className="space-y-4">
        {filteredApps.map((app) => (
          <Collapsible key={app.path}>
            <div className="flex items-center justify-between p-2 rounded-lg hover:bg-accent">
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{app.name}</h3>
                    <p className="text-sm text-muted-foreground">{app.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBackup(app)}
                      disabled={backingUp === app.name}
                    >
                      {backingUp === app.name ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Backup
                    </Button>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
                {progress[app.name] && (
                  <div className="mt-2">
                    <Progress value={progress[app.name].current} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {progress[app.name].details}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <CollapsibleContent className="px-2 pb-2">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Settings & Files</h4>
                <ul className="space-y-1">
                  {app.settings.map((setting, index) => (
                    <li key={index} className="text-sm">
                      <span className="text-muted-foreground">{setting.type}:</span>{' '}
                      {setting.path}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Total Size: {formatBytes(app.size)}
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  )
} 