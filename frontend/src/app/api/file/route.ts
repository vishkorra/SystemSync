'use server'

import { NextResponse } from 'next/server'
import { createReadStream } from 'fs'
import { stat, access, constants } from 'fs/promises'
import { headers } from 'next/headers'
import { join, normalize } from 'path'
import { homedir } from 'os'

// Add CORS headers to response
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return response
}

export async function OPTIONS() {
  return addCorsHeaders(new NextResponse(null, { status: 200 }))
}

// Helper function to validate file path
async function validatePath(path: string): Promise<boolean> {
  try {
    // Normalize path to prevent directory traversal attacks
    const normalizedPath = normalize(path)
    
    // Check if path is within allowed directories
    const homeDir = homedir()
    const allowedPaths = [
      join(homeDir, 'Library/Application Support/Code'),
      join(homeDir, '.vscode'),
      '/Applications/Visual Studio Code.app'
    ]
    
    const isAllowed = allowedPaths.some(allowedPath => 
      normalizedPath.startsWith(allowedPath)
    )
    
    if (!isAllowed) {
      return false
    }
    
    // Check if file exists and is readable
    await access(normalizedPath, constants.R_OK)
    return true
  } catch (error) {
    return false
  }
}

export async function POST(request: Request) {
  try {
    // Set a timeout for the request
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    try {
      const { path, start, end } = await request.json()
      
      // Validate the path
      const isValid = await validatePath(path)
      if (!isValid) {
        clearTimeout(timeoutId)
        return addCorsHeaders(
          NextResponse.json(
            { error: 'Invalid file path or file not accessible' },
            { status: 403 }
          )
        )
      }

      // Get file stats
      const stats = await stat(path)
      if (!stats.isFile()) {
        clearTimeout(timeoutId)
        return addCorsHeaders(
          NextResponse.json(
            { error: 'Not a file' },
            { status: 400 }
          )
        )
      }

      // Validate chunk range
      const chunkStart = Math.max(0, start)
      const chunkEnd = Math.min(stats.size, end)
      
      if (chunkStart >= chunkEnd) {
        clearTimeout(timeoutId)
        return addCorsHeaders(
          NextResponse.json(
            { error: 'Invalid range' },
            { status: 400 }
          )
        )
      }

      // Create readable stream for the chunk
      const stream = createReadStream(path, { start: chunkStart, end: chunkEnd - 1 })
      
      // Convert stream to buffer
      const chunks: Buffer[] = []
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk))
      }
      const buffer = Buffer.concat(chunks)

      clearTimeout(timeoutId)
      
      // Return the chunk as a blob with CORS headers
      return addCorsHeaders(
        new NextResponse(buffer, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'no-store'
          }
        })
      )
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        return addCorsHeaders(
          NextResponse.json(
            { error: 'Request timeout' },
            { status: 408 }
          )
        )
      }
      throw error
    }
  } catch (error: any) {
    console.error('Error reading file chunk:', error)
    return addCorsHeaders(
      NextResponse.json(
        { error: error.message || 'Failed to read file chunk' },
        { status: 500 }
      )
    )
  }
} 