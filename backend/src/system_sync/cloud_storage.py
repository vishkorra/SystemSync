import os
from typing import Optional, Dict, List
from datetime import datetime
import logging
from supabase_client import supabase, BACKUPS_TABLE, BACKUP_FILES_TABLE
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CloudStorage:
    def __init__(self):
        self.bucket_name = 'app-backups'
        self._init_storage()

    def _init_storage(self):
        """Initialize Supabase storage bucket."""
        try:
            # Create bucket if it doesn't exist
            supabase.storage.create_bucket(self.bucket_name, {'public': False})
        except Exception as e:
            # Bucket might already exist
            logger.info(f"Bucket initialization: {str(e)}")

    async def upload_backup(self, 
                          user_id: str,
                          app_name: str, 
                          file_path: str, 
                          metadata: Dict,
                          callback=None) -> Optional[str]:
        """Upload backup to Supabase Storage and record in database."""
        try:
            file_name = os.path.basename(file_path)
            file_size = os.path.getsize(file_path)
            
            # Upload file to Supabase Storage
            with open(file_path, 'rb') as f:
                storage_path = f"{user_id}/{app_name}/{file_name}"
                supabase.storage.from_(self.bucket_name).upload(
                    storage_path,
                    f
                )

            # Create backup record in database
            backup_data = {
                'user_id': user_id,
                'app_name': app_name,
                'file_name': file_name,
                'storage_path': storage_path,
                'size': file_size,
                'created_at': datetime.now().isoformat(),
                'metadata': metadata
            }

            result = supabase.table(BACKUPS_TABLE).insert(backup_data).execute()
            
            if result.data:
                return storage_path
            return None

        except Exception as e:
            logger.error(f"Error uploading backup: {str(e)}")
            return None

    async def download_backup(self, 
                            user_id: str,
                            storage_path: str, 
                            destination: str,
                            callback=None) -> bool:
        """Download backup from Supabase Storage."""
        try:
            # Download file from Supabase Storage
            data = supabase.storage.from_(self.bucket_name).download(storage_path)
            
            # Ensure destination directory exists
            os.makedirs(os.path.dirname(destination), exist_ok=True)
            
            # Write file to destination
            with open(destination, 'wb') as f:
                f.write(data)
                
            return True

        except Exception as e:
            logger.error(f"Error downloading backup: {str(e)}")
            return False

    async def list_backups(self, user_id: str, app_name: Optional[str] = None) -> List[Dict]:
        """List available backups for a user."""
        try:
            query = supabase.table(BACKUPS_TABLE).select('*').eq('user_id', user_id)
            
            if app_name:
                query = query.eq('app_name', app_name)
                
            result = query.execute()
            return result.data

        except Exception as e:
            logger.error(f"Error listing backups: {str(e)}")
            return []

    async def delete_backup(self, user_id: str, storage_path: str) -> bool:
        """Delete backup from Supabase Storage and database."""
        try:
            # Delete from storage
            supabase.storage.from_(self.bucket_name).remove([storage_path])
            
            # Delete from database
            supabase.table(BACKUPS_TABLE)\
                .delete()\
                .eq('user_id', user_id)\
                .eq('storage_path', storage_path)\
                .execute()
                
            return True

        except Exception as e:
            logger.error(f"Error deleting backup: {str(e)}")
            return False

    async def get_user_storage_usage(self, user_id: str) -> Dict:
        """Get storage usage statistics for a user."""
        try:
            result = supabase.table(BACKUPS_TABLE)\
                .select('size')\
                .eq('user_id', user_id)\
                .execute()
                
            total_size = sum(row['size'] for row in result.data)
            backup_count = len(result.data)
            
            return {
                'total_size': total_size,
                'backup_count': backup_count
            }

        except Exception as e:
            logger.error(f"Error getting storage usage: {str(e)}")
            return {'total_size': 0, 'backup_count': 0} 