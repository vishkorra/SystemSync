'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AppList } from "@/components/AppList"
import { BackupsList } from "@/components/BackupsList"
import { Settings, Download, Upload, List, RefreshCw, Code2, Check, Settings2, Zap, Shield, Cloud, ArrowRight, Sparkles, Trash2, ChevronDown, FolderOpen } from "lucide-react"
import { BackupUploader } from "@/components/BackupUploader"
import { Toaster } from "@/components/ui/toaster"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { VSCodeBackup } from "@/components/VSCodeBackup"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { generateVSCodeInstaller, detectPlatform } from "@/lib/supabase"

export default function DemoPage() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState("applications")
  const [showWelcome, setShowWelcome] = useState(true)
  const [backupExpanded, setBackupExpanded] = useState(false)
  const [isGeneratingInstaller, setIsGeneratingInstaller] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const { toast } = useToast()

  useEffect(() => {
    // Auto-hide welcome message after 5 seconds
    const timer = setTimeout(() => {
      setShowWelcome(false)
    }, 5000)
    
    return () => clearTimeout(timer)
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Simulate refresh delay
    setTimeout(() => {
      setIsRefreshing(false)
      toast({
        title: "Refreshed",
        description: "Application list has been updated",
      })
    }, 1000)
  }

  // Function to handle VS Code download with settings
  const handleVSCodeDownload = async () => {
    try {
      setIsGeneratingInstaller(true);
      setDownloadProgress(0);
      
      // Show initial toast with progress indication
      toast({
        title: "Preparing Download",
        description: "Building your custom VS Code package with your settings...",
        duration: 3000,
      });
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setDownloadProgress(prev => {
          const newProgress = prev + Math.random() * 10;
          return newProgress > 90 ? 90 : newProgress;
        });
      }, 500);
      
      // Get the user's platform
      const platform = detectPlatform();
      console.log("Detected platform:", platform);
      
      // In a real app, we would get the actual backup ID
      // For the demo, we'll use a fake ID
      const demoBackupId = "demo-backup-123";
      
      try {
        console.log("Calling Supabase function with:", { backupId: demoBackupId, platform });
        
        // Call the Edge Function to generate the installer
        const result = await generateVSCodeInstaller(demoBackupId, platform);
        console.log("Supabase function result:", result);
        
        // Clear the progress interval
        clearInterval(progressInterval);
        setDownloadProgress(100);
        
        // Show success toast
        toast({
          title: "Download Ready",
          description: "Your custom VS Code package is ready to download.",
          duration: 5000,
        });
        
        // Redirect to the download URL
        if (result && result.downloadUrl) {
          window.open(result.downloadUrl, '_blank');
        } else {
          // Fallback to direct VS Code download if no URL is returned
          const directDownloadUrl = getDirectVSCodeDownloadUrl(platform);
          window.open(directDownloadUrl, '_blank');
          
          toast({
            title: "Using Standard Download",
            description: "We're downloading the standard VS Code package instead.",
            duration: 5000,
          });
        }
      } catch (error) {
        console.error("Error generating VS Code installer:", error);
        clearInterval(progressInterval);
        
        // Fallback to direct VS Code download
        const directDownloadUrl = getDirectVSCodeDownloadUrl(platform);
        window.open(directDownloadUrl, '_blank');
        
        toast({
          title: "Using Standard Download",
          description: "We encountered an issue with the custom installer. Downloading standard VS Code instead.",
          variant: "destructive",
          duration: 5000,
        });
      } finally {
        setIsGeneratingInstaller(false);
        setDownloadProgress(0);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again later.",
        variant: "destructive",
        duration: 5000,
      });
      setIsGeneratingInstaller(false);
      setDownloadProgress(0);
    }
  };
  
  // Helper function to get direct VS Code download URL
  const getDirectVSCodeDownloadUrl = (platform: string) => {
    switch (platform) {
      case 'mac_intel':
      case 'mac_arm':
        return 'https://code.visualstudio.com/sha/download?build=stable&os=darwin-universal';
      case 'windows':
        return 'https://code.visualstudio.com/sha/download?build=stable&os=win32-x64-user';
      case 'linux_deb':
        return 'https://code.visualstudio.com/sha/download?build=stable&os=linux-deb-x64';
      case 'linux_rpm':
        return 'https://code.visualstudio.com/sha/download?build=stable&os=linux-rpm-x64';
      default:
        return 'https://code.visualstudio.com/Download';
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
                Interactive Demo
              </h1>
              <p className="text-gray-500 md:text-xl dark:text-gray-400 max-w-xl mt-3">
                Experience the power of System Sync. Back up your applications, restore settings, and see how easy it is to keep your digital environment in sync.
              </p>
            </div>
            
            <div className="flex gap-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Create Backup
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Create Backup</DialogTitle>
                    <DialogDescription>
                      Select applications and settings to back up
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-2">
                    <VSCodeBackup />
                    <BackupUploader />
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </section>
      
      {/* Welcome Message */}
      {showWelcome && (
        <div className="container px-4 md:px-6 py-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3" />
              <p className="text-gray-700 dark:text-gray-300">Welcome to the System Sync demo! Explore the features below to see how it works.</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-800/30"
              onClick={() => setShowWelcome(false)}
            >
              <Check className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Feature Cards */}
      <section className="w-full py-8">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm">
              <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-800/20">
                <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold">Fast Backups</h3>
              <p className="text-sm text-gray-500 text-center dark:text-gray-400">
                Create backups of your applications and settings in seconds.
              </p>
            </div>
            
            <div className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm">
              <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-800/20">
                <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold">Secure Storage</h3>
              <p className="text-sm text-gray-500 text-center dark:text-gray-400">
                Your backups are stored securely with end-to-end encryption.
              </p>
            </div>
            
            <div className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm">
              <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-800/20">
                <Cloud className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold">Easy Restore</h3>
              <p className="text-sm text-gray-500 text-center dark:text-gray-400">
                Restore your settings on any device with just a few clicks.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Main Content */}
      <section className="w-full py-8">
        <div className="container px-4 md:px-6">
          <Tabs defaultValue="applications" className="w-full" onValueChange={setActiveTab}>
            <div className="flex justify-between items-center mb-6">
              <TabsList>
                <TabsTrigger value="applications">
                  <List className="w-4 h-4 mr-2" />
                  Applications
                </TabsTrigger>
                <TabsTrigger value="backups">
                  <Download className="w-4 h-4 mr-2" />
                  Backups
                </TabsTrigger>
              </TabsList>
              
              {activeTab === "applications" && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Create Backup
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>Create Backup</DialogTitle>
                      <DialogDescription>
                        Select applications and settings to back up
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                      <VSCodeBackup />
                      <BackupUploader />
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            
            <TabsContent value="applications" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <List className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    System Applications
                  </CardTitle>
                  <CardDescription>
                    Backup settings and configurations from your installed applications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AppList />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="backups" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    System Backups
                  </CardTitle>
                  <CardDescription>
                    Restore your applications and settings from previous backups
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Demo Backup Item */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="font-medium">vscode</h3>
                      <div className="space-y-2">
                        <Collapsible
                          open={backupExpanded}
                          onOpenChange={setBackupExpanded}
                        >
                          <div className="flex items-center justify-between p-4 rounded-lg border">
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">
                                    Feb 26, 2025, 4:45 AM
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Size: 1.2 GB
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      toast({
                                        title: "Restore Started",
                                        description: "Restoring VS Code settings and extensions. This may take a few minutes...",
                                      });
                                    }}
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Restore Selected
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      toast({
                                        title: "Download Started",
                                        description: "Your backup file download has started.",
                                      });
                                    }}
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download
                                  </Button>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                                    onClick={handleVSCodeDownload}
                                    disabled={isGeneratingInstaller}
                                  >
                                    {isGeneratingInstaller ? (
                                      <>
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                        Preparing...
                                      </>
                                    ) : (
                                      <>
                                        <Download className="w-4 h-4 mr-2" />
                                        Download VS Code App
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      toast({
                                        title: "Backup Deleted",
                                        description: "The backup has been deleted successfully.",
                                      });
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </Button>
                                  <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <ChevronDown className={`h-4 w-4 transition-transform ${backupExpanded ? 'rotate-180' : ''}`} />
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
                              <div className="mt-4 space-y-4">
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id="userData"
                                      checked={true}
                                      onCheckedChange={() => {}}
                                    />
                                    <label 
                                      htmlFor="userData"
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
                                      id="extensions"
                                      checked={true}
                                      onCheckedChange={() => {}}
                                    />
                                    <label 
                                      htmlFor="extensions"
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
                                      id="workspaceStorage"
                                      checked={true}
                                      onCheckedChange={() => {}}
                                    />
                                    <label 
                                      htmlFor="workspaceStorage"
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
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="w-full py-6 md:py-12 bg-gray-100 dark:bg-gray-950 mt-auto">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="flex items-center space-x-2">
              <Settings className="h-6 w-6" />
              <span className="text-lg font-bold">System Sync</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              © {new Date().getFullYear()} System Sync. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
} 