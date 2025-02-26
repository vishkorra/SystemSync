import { App, Backup } from '@/types'

// Allow the API URL to be configured through environment variables
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
export { API_BASE }

export async function getApplications(): Promise<App[]> {
  const response = await fetch(`${API_BASE}/apps`)
  if (!response.ok) {
    throw new Error('Failed to fetch applications')
  }
  return response.json()
}

export async function getBackups(appName?: string): Promise<Record<string, Backup[]>> {
  console.log(`Fetching backups${appName ? ` for ${appName}` : ''}...`)
  try {
    const url = appName ? `${API_BASE}/backups?app_name=${appName}` : `${API_BASE}/backups`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch backups: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    console.log('Backups data received:', data)
    
    // For demo/testing purposes, if the server doesn't return proper data
    // but we're in development mode, create some sample backups
    if ((!data || Object.keys(data).length === 0) && process.env.NODE_ENV === 'development') {
      console.log('Using demo backups data')
      return getDemoBackups(appName)
    }
    
    return data
  } catch (error) {
    console.error('Error in getBackups:', error)
    
    // In development, return demo data on error
    if (process.env.NODE_ENV === 'development') {
      console.log('Using demo backups data due to error')
      return getDemoBackups(appName)
    }
    
    throw error
  }
}

export async function createBackup(appName: string): Promise<Backup> {
  console.log(`Creating backup for ${appName}...`)
  try {
    const response = await fetch(`${API_BASE}/backup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ app_name: appName }),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to create backup: ${response.status} ${response.statusText}. ${errorText}`)
    }
    
    // Try to parse the response as JSON
    try {
      const data = await response.json()
      console.log('Backup created successfully:', data)
      return data
    } catch (parseError) {
      console.warn('Could not parse backup creation response as JSON')
      
      // If we're in development and can't parse the response, 
      // return a dummy backup for testing
      if (process.env.NODE_ENV === 'development') {
        const demoBackup: Backup = {
          id: Date.now(),
          app_name: appName,
          created_at: new Date().toISOString(),
          size: 1024 * 1024 * Math.random() * 10, // Random size between 0-10MB
          version: 1,
          files: [],
          filename: `${appName}_backup_${Date.now()}.zip`
        }
        console.log('Created demo backup:', demoBackup)
        return demoBackup
      }
      
      throw new Error('Could not parse backup creation response')
    }
  } catch (error) {
    console.error('Error in createBackup:', error)
    
    // In development, return a demo backup on error
    if (process.env.NODE_ENV === 'development') {
      const demoBackup: Backup = {
        id: Date.now(),
        app_name: appName,
        created_at: new Date().toISOString(),
        size: 1024 * 1024 * Math.random() * 10, // Random size between 0-10MB
        version: 1,
        files: [],
        filename: `${appName}_backup_${Date.now()}.zip`
      }
      console.log('Created demo backup due to error:', demoBackup)
      return demoBackup
    }
    
    throw error
  }
}

export async function restoreBackup(backupId: number, files?: string[]): Promise<void> {
  const response = await fetch(`${API_BASE}/restore`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      backup_id: backupId,
      files: files // Optional array of file paths to restore
    }),
  })
  if (!response.ok) {
    throw new Error('Failed to restore backup')
  }
}

export async function deleteBackup(backupId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/backup/${backupId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error('Failed to delete backup')
  }
}

export async function getBackupProgress(appName: string): Promise<{ progress: number; status: string }> {
  try {
    const response = await fetch(`${API_BASE}/backup/progress/${appName}`)
    if (!response.ok) {
      // If the response is a 404, it means there's no backup in progress
      if (response.status === 404) {
        return { progress: 0, status: 'idle' }
      }
      throw new Error('Failed to get backup progress')
    }
    return response.json()
  } catch (error) {
    console.warn('Error fetching backup progress:', error)
    // Return a default value instead of throwing an error
    return { progress: 0, status: 'idle' }
  }
}

export async function packageVSCode(backupId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/backup/${backupId}/package-vscode`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // If the response is not OK, try to parse the error message
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to package VS Code: ${response.status} ${response.statusText}`);
      } catch (parseError) {
        throw new Error(`Failed to package VS Code: ${response.status} ${response.statusText}`);
      }
    }

    // For successful responses, we don't need to parse JSON as the endpoint now returns a file directly
    return { success: true };
  } catch (error) {
    console.error('Error packaging VS Code:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Helper function to generate demo backups data for development
function getDemoBackups(appName?: string): Record<string, Backup[]> {
  const apps = ['vscode', 'figma', 'chrome', 'slack'];
  const result: Record<string, Backup[]> = {};
  
  // If specific app requested, only generate for that app
  const appsToUse = appName ? [appName] : apps;
  
  for (const app of appsToUse) {
    // Skip if app not in our list
    if (appName && !apps.includes(appName)) continue;
    
    // Generate 1-3 backups per app
    const numBackups = Math.floor(Math.random() * 3) + 1;
    const backups: Backup[] = [];
    
    for (let i = 0; i < numBackups; i++) {
      const id = Date.now() - i * 86400000; // Each one a day apart
      const backup: Backup = {
        id,
        app_name: app,
        created_at: new Date(id).toISOString(),
        size: 1024 * 1024 * Math.random() * 10, // Random size between 0-10MB
        version: i + 1,
        files: generateDemoFiles(app),
        filename: `${app}_backup_${id}.zip`
      };
      backups.push(backup);
    }
    
    result[app] = backups;
  }
  
  return result;
}

// Helper to generate demo files based on app
function generateDemoFiles(app: string): string[] {
  switch(app) {
    case 'vscode':
      return [
        'userData/settings.json',
        'userData/keybindings.json',
        'userData/snippets',
        'extensions/ms-python.python',
        'extensions/esbenp.prettier-vscode'
      ];
    case 'figma':
      return [
        'preferences.json',
        'recent_files.json',
        'templates',
        'plugins'
      ];
    case 'chrome':
      return [
        'bookmarks.json',
        'extensions.json',
        'settings.json',
        'history.dat'
      ];
    case 'slack':
      return [
        'preferences.json',
        'themes.json',
        'workspaces.json',
        'keywords.json'
      ];
    default:
      return ['settings.json', 'data.json'];
  }
} 