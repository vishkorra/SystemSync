import { supabase } from './supabase'
import JSZip from 'jszip'
import { API_BASE } from './api'

export interface VSCodeSettings {
  userData: {
    path: string
    exists: boolean
    size: number
  }
  extensions: {
    path: string
    exists: boolean
    size: number
    list: string[]
  }
  extensionGlobalStorage: {
    path: string
    exists: boolean
    size: number
  }
  workspaceStorage: {
    path: string
    exists: boolean
    size: number
  }
  application: {
    path: string
    exists: boolean
    size: number
  }
}

export const detectVSCodeSettings = async (): Promise<VSCodeSettings> => {
  const response = await fetch('/api/vscode')
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to detect VSCode settings')
  }
  return response.json()
}

interface FileInfo {
  type: 'file'
  path: string
  size: number
}

interface DirectoryInfo {
  type: 'directory'
  path: string
  files: Record<string, FileInfo | DirectoryInfo>
}

interface ComponentData {
  type: 'directory'
  path: string
  files: Record<string, FileInfo | DirectoryInfo>
}

async function fetchFileChunk(filePath: string, start: number, end: number, maxRetries = 3): Promise<Uint8Array> {
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      const response = await fetch('/api/file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: filePath,
          start,
          end
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error fetching chunk (attempt ${retries + 1}/${maxRetries + 1}):`, errorText);
        throw new Error(`Failed to fetch file chunk: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      return new Uint8Array(await blob.arrayBuffer());
    } catch (error) {
      retries++;
      console.error(`Fetch attempt ${retries}/${maxRetries + 1} failed:`, error);
      
      if (retries > maxRetries) {
        console.error('Max retries reached, giving up');
        throw error;
      }
      
      // Exponential backoff: 500ms, 1000ms, 2000ms, etc.
      const delay = Math.min(500 * Math.pow(2, retries - 1), 5000);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // This should never be reached due to the throw in the catch block
  throw new Error('Failed to fetch file chunk after retries');
}

async function processFilesSequentially(
  files: Record<string, FileInfo>,
  componentFolder: JSZip,
  onProgress: (processedSize: number) => void
): Promise<void> {
  const fileEntries = Object.entries(files);
  let processedCount = 0;
  const totalCount = fileEntries.length;
  
  for (const [path, fileInfo] of fileEntries) {
    if (fileInfo.type !== 'file') continue
    
    try {
      processedCount++;
      console.log(`Processing file ${processedCount}/${totalCount}: ${path}`);
      
      // No file size limit - process all files regardless of size
      
      const chunkSize = 1024 * 1024 // 1MB chunks
      const totalChunks = Math.ceil(fileInfo.size / chunkSize)
      const chunks: Uint8Array[] = []

      // Process chunks sequentially
      for (let i = 0; i < totalChunks; i++) {
        try {
          const start = i * chunkSize
          const end = Math.min(start + chunkSize, fileInfo.size)
          const chunk = await fetchFileChunk(fileInfo.path, start, end)
          chunks.push(chunk)
          onProgress(chunk.length)
        } catch (error) {
          console.error(`Error processing chunk ${i+1}/${totalChunks} for file ${path}:`, error);
          // If we can't get a chunk, we can't use this file
          throw error;
        }
      }

      // Combine chunks and add to zip
      const fileContent = new Uint8Array(fileInfo.size)
      let offset = 0
      for (const chunk of chunks) {
        fileContent.set(chunk, offset)
        offset += chunk.length
      }

      componentFolder.file(path, fileContent)
    } catch (err) {
      console.error(`Error processing file ${path}:`, err)
      // Continue with next file instead of failing entire backup
      // But still update progress to avoid getting stuck
      onProgress(Math.min(1024, fileInfo.size)); // Count at least 1KB as processed
    }
  }
}

export const backupVSCode = async (
  onProgress: (progress: number, message: string) => void,
  selectedSettings: Set<string>,
  selectedExtensions: Set<string>
): Promise<Uint8Array> => {
  try {
    console.log('Starting VSCode backup...')
    onProgress(0, 'Reading VSCode files...')

    const response = await fetch('/api/vscode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        selectedSettings: Array.from(selectedSettings),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error response:', errorText)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    if (!data.files) {
      throw new Error('No files received from server')
    }
    
    onProgress(20, 'Creating backup archive...')
    
    // Create zip file
    const zip = new JSZip()
    
    // Calculate total size
    let totalSize = 0
    const components = Object.keys(data.files)
    
    for (const component of components) {
      const componentData = data.files[component] as ComponentData
      if (componentData.type === 'directory') {
        for (const [_, fileInfo] of Object.entries(componentData.files)) {
          if (fileInfo.type === 'file') {
            totalSize += fileInfo.size
          }
        }
      }
    }
    
    // Process components sequentially
    let processedSize = 0
    
    for (const component of components) {
      const componentData = data.files[component] as ComponentData
      if (componentData.type !== 'directory') continue
      
      const componentFolder = zip.folder(component)
      if (!componentFolder) {
        console.error(`Failed to create folder for component: ${component}`)
        continue
      }
      
      onProgress(
        20 + Math.floor((processedSize / totalSize) * 70),
        `Processing ${component}...`
      )
      
      await processFilesSequentially(
        componentData.files as Record<string, FileInfo>,
        componentFolder,
        (chunkSize) => {
          processedSize += chunkSize
          onProgress(
            20 + Math.floor((processedSize / totalSize) * 70),
            `Processing ${component}... (${Math.floor(processedSize / totalSize * 100)}%)`
          )
        }
      )
    }

    onProgress(90, 'Finalizing backup...')
    const content = await zip.generateAsync({ 
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9
      }
    })

    onProgress(100, 'Backup completed!')
    return content
  } catch (error: any) {
    console.error('Error in backupVSCode:', error)
    throw error
  }
}

export const restoreVSCode = async (
  backupId: string,
  onProgress: (progress: number, message: string) => void
): Promise<void> => {
  try {
    // Step 1: Download backup
    onProgress(0, 'Initiating restore process...')
    
    // Call the backend API to restore the backup
    onProgress(20, 'Sending restore request to server...')
    
    const response = await fetch(`${API_BASE}/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        backup_id: parseInt(backupId, 10)
      }),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Restore error:', errorText)
      throw new Error(`Failed to restore: ${response.status} ${response.statusText}`)
    }
    
    const responseData = await response.json()
    console.log('Restore response:', responseData)
    
    if (responseData.status !== 'restore completed') {
      throw new Error(`Unexpected response: ${JSON.stringify(responseData)}`)
    }
    
    // Step 2: Wait for server to process
    onProgress(40, 'Server is extracting backup files...')
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Step 3: Wait for server to restore files
    onProgress(60, 'Server is restoring VSCode settings...')
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Step 4: Wait for server to restore extensions
    onProgress(80, 'Server is restoring VSCode extensions...')
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Complete
    onProgress(100, 'Restore completed!')
    
    // Show success message
    console.log('VSCode settings restored successfully')
  } catch (error) {
    console.error('Error in restoreVSCode:', error)
    throw error
  }
} 