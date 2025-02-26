import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Initialize the Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://etkciehuenjzmoroewyo.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0a2NpZWh1ZW5qem1vcm9ld3lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDg5NTk5MzcsImV4cCI6MjAyNDUzNTkzN30.Nh83ebqzv3RKwlVOZ0BI_QWFiYVSDYyGOeE8xbhzIYU';

console.log('Supabase URL:', supabaseUrl);

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * Generate a VS Code installer with user settings
 * @param backupId The ID of the backup to use for settings
 * @param platform The platform to generate the installer for
 * @returns Promise with the installer details
 */
export async function generateVSCodeInstaller(backupId: string, platform: string) {
  try {
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    // For demo purposes, use a fixed user ID if not authenticated
    const userId = user?.id || 'demo-user-123';
    
    console.log('Using user ID for installer generation:', userId);
    
    // Call the Edge Function to generate the installer
    console.log('Invoking Edge Function with:', { userId, backupId, platform });
    console.log('Function URL:', `${supabaseUrl}/functions/v1/generate-vscode-installer`);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-vscode-installer', {
        body: {
          userId: userId,
          backupId,
          platform
        }
      });
      
      if (error) {
        console.error('Edge Function error:', error);
        throw new Error(`Error generating installer: ${error.message}`);
      }
      
      console.log('Edge Function response:', data);
      return data;
    } catch (functionError) {
      console.error('Error invoking Edge Function:', functionError);
      
      // For demo users, provide a fallback response
      if (userId === 'demo-user-123' || backupId === 'demo-backup-123') {
        console.log('Providing fallback response for demo user');
        
        // Generate a direct VS Code download URL based on platform
        let downloadUrl;
        switch (platform) {
          case 'mac_intel':
          case 'mac_arm':
            downloadUrl = 'https://code.visualstudio.com/sha/download?build=stable&os=darwin-universal';
            break;
          case 'windows':
            downloadUrl = 'https://code.visualstudio.com/sha/download?build=stable&os=win32-x64-user';
            break;
          case 'linux_deb':
            downloadUrl = 'https://code.visualstudio.com/sha/download?build=stable&os=linux-deb-x64';
            break;
          case 'linux_rpm':
            downloadUrl = 'https://code.visualstudio.com/sha/download?build=stable&os=linux-rpm-x64';
            break;
          default:
            downloadUrl = 'https://code.visualstudio.com/Download';
        }
        
        return {
          status: 'completed',
          installerId: crypto.randomUUID(),
          downloadUrl,
          platform,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
        };
      }
      
      throw functionError;
    }
  } catch (error) {
    console.error('Error generating VS Code installer:', error);
    throw error;
  }
}

/**
 * Check the status of a VS Code installer generation
 * @param installerId The ID of the installer to check
 * @returns Promise with the installer status
 */
export async function checkInstallerStatus(installerId: string) {
  try {
    const { data, error } = await supabase
      .from('vscode_installers')
      .select('*')
      .eq('id', installerId)
      .single();
    
    if (error) {
      throw new Error(`Error checking installer status: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    console.error('Error checking installer status:', error);
    throw error;
  }
}

/**
 * Increment the download count for a VS Code installer
 * @param installerId The ID of the installer
 */
export async function trackInstallerDownload(installerId: string) {
  try {
    const { error } = await supabase.rpc('increment_installer_download_count', {
      installer_id: installerId
    });
    
    if (error) {
      console.error('Error tracking installer download:', error);
    }
  } catch (error) {
    console.error('Error tracking installer download:', error);
  }
}

/**
 * Detect the user's platform for VS Code installer
 * @returns The platform identifier
 */
export function detectPlatform() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  
  // Check for macOS
  if (userAgent.includes('mac os x') || userAgent.includes('macintosh')) {
    // Check for Apple Silicon (M1/M2)
    if (userAgent.includes('arm64') || 
        (window.navigator as any).userAgentData?.platform === 'macOS' && 
        (window.navigator as any).userAgentData?.architecture === 'arm') {
      return 'mac_arm';
    }
    return 'mac_intel';
  }
  
  // Check for Windows
  if (userAgent.includes('windows')) {
    return 'windows';
  }
  
  // Check for Linux
  if (userAgent.includes('linux')) {
    // Simplified detection for Debian-based vs RPM-based
    // In a real app, you might want to use more sophisticated detection
    if (userAgent.includes('ubuntu') || userAgent.includes('debian')) {
      return 'linux_deb';
    }
    return 'linux_rpm';
  }
  
  // Default to Windows if we can't determine the platform
  return 'windows';
} 