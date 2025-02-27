'use server'

import { NextResponse } from 'next/server'
import { homedir } from 'os'
import { join } from 'path'
import { readFileSync, existsSync, statSync, readdirSync } from 'fs'

// VSCode settings paths based on OS
const getVSCodePaths = () => {
  const userHome = homedir()
  
  // Complete VSCode paths for different operating systems
  const paths = {
    darwin: {
      // User Data directory (contains all user-specific data)
      userData: join(userHome, 'Library', 'Application Support', 'Code'),
      // Extensions directory
      extensions: join(userHome, '.vscode', 'extensions'),
      // VSCode application directory
      application: '/Applications/Visual Studio Code.app',
      // Extension global storage
      extensionGlobalStorage: join(userHome, 'Library', 'Application Support', 'Code', 'User', 'globalStorage'),
      // Workspaces storage
      workspaceStorage: join(userHome, 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage'),
    },
    linux: {
      userData: join(userHome, '.config', 'Code'),
      extensions: join(userHome, '.vscode', 'extensions'),
      application: '/usr/share/code',  // Default installation path
      extensionGlobalStorage: join(userHome, '.config', 'Code', 'User', 'globalStorage'),
      workspaceStorage: join(userHome, '.config', 'Code', 'User', 'workspaceStorage'),
    },
    win32: {
      userData: join(userHome, 'AppData', 'Roaming', 'Code'),
      extensions: join(userHome, '.vscode', 'extensions'),
      application: join('C:', 'Program Files', 'Microsoft VS Code'),
      extensionGlobalStorage: join(userHome, 'AppData', 'Roaming', 'Code', 'User', 'globalStorage'),
      workspaceStorage: join(userHome, 'AppData', 'Roaming', 'Code', 'User', 'workspaceStorage'),
    }
  }

  return paths[process.platform as keyof typeof paths] || paths.linux
}

// Helper function to get directory size
function getDirectorySize(dirPath: string): number {
  let size = 0
  if (!existsSync(dirPath)) {
    console.log(`Directory does not exist: ${dirPath}`)
    return size
  }

  try {
    const files = readdirSync(dirPath, { withFileTypes: true })
    for (const file of files) {
      try {
        const filePath = join(dirPath, file.name)
        if (file.isFile()) {
          const stats = statSync(filePath)
          size += stats.size
        } else if (file.isDirectory()) {
          size += getDirectorySize(filePath)
        }
      } catch (error) {
        console.error(`Error processing file ${file.name} in directory ${dirPath}:`, error)
        // Continue with next file even if there's an error with this one
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error)
  }
  
  console.log(`Directory ${dirPath} size: ${size} bytes`)
  return size
}

// Helper function to read file content in chunks
function readFileInChunks(filePath: string, maxChunkSize: number = 1024 * 1024) { // 1MB chunks
  if (!existsSync(filePath)) {
    console.log(`File does not exist: ${filePath}`)
    return null
  }
  try {
    const stats = statSync(filePath)
    return {
      size: stats.size,
      type: 'file',
      path: filePath
    }
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error)
    return null
  }
}

// Helper function to read directory recursively
function readDirectoryRecursively(dirPath: string, baseDir: string): Record<string, any> {
  const files: Record<string, any> = {}
  if (!existsSync(dirPath)) return files

  const entries = readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    const relativePath = fullPath.replace(baseDir, '').replace(/^[/\\]/, '')

    if (entry.isFile()) {
      const fileInfo = readFileInChunks(fullPath)
      if (fileInfo) {
        files[relativePath] = fileInfo
      }
    } else if (entry.isDirectory()) {
      Object.assign(files, readDirectoryRecursively(fullPath, baseDir))
    }
  }
  return files
}

export async function GET() {
  try {
    const paths = getVSCodePaths()
    const settings = {
      userData: {
        path: paths.userData,
        exists: existsSync(paths.userData),
        size: existsSync(paths.userData) ? getDirectorySize(paths.userData) : 0
      },
      extensions: {
        path: paths.extensions,
        exists: existsSync(paths.extensions),
        size: existsSync(paths.extensions) ? getDirectorySize(paths.extensions) : 0,
        list: existsSync(paths.extensions) ? 
          readdirSync(paths.extensions)
            .filter(dir => existsSync(join(paths.extensions, dir, 'package.json')))
            .map(dir => dir.toLowerCase()) : []
      },
      application: {
        path: paths.application,
        exists: existsSync(paths.application),
        size: existsSync(paths.application) ? getDirectorySize(paths.application) : 0
      },
      extensionGlobalStorage: {
        path: paths.extensionGlobalStorage,
        exists: existsSync(paths.extensionGlobalStorage),
        size: existsSync(paths.extensionGlobalStorage) ? getDirectorySize(paths.extensionGlobalStorage) : 0
      },
      workspaceStorage: {
        path: paths.workspaceStorage,
        exists: existsSync(paths.workspaceStorage),
        size: existsSync(paths.workspaceStorage) ? getDirectorySize(paths.workspaceStorage) : 0
      }
    }

    return NextResponse.json(settings)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to detect VSCode installation' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  console.log('POST request received at /api/vscode')
  try {
    console.log('Parsing request body...')
    const body = await request.json()
    const selectedSettings: string[] = body.selectedSettings || []
    console.log('Selected settings:', selectedSettings)

    const paths = getVSCodePaths()
    const files: Record<string, any> = {}

    // Process each selected component
    for (const setting of selectedSettings) {
      let basePath = ''
      switch (setting) {
        case 'userData':
          basePath = paths.userData
          break
        case 'extensions':
          basePath = paths.extensions
          break
        case 'extensionGlobalStorage':
          basePath = paths.extensionGlobalStorage
          break
        case 'workspaceStorage':
          basePath = paths.workspaceStorage
          break
        case 'application':
          basePath = paths.application
          break
      }

      if (basePath && existsSync(basePath)) {
        console.log(`Processing ${setting} at ${basePath}`)
        const componentFiles = readDirectoryRecursively(basePath, basePath)
        Object.assign(files, {
          [setting]: {
            type: 'directory',
            path: basePath,
            files: componentFiles
          }
        })
      }
    }

    console.log(`Backup complete. Total components: ${Object.keys(files).length}`)
    return NextResponse.json({ files })
  } catch (error: any) {
    console.error('Error creating backup:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create VSCode backup' },
      { status: 500 }
    )
  }
} 