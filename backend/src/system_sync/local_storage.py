import os
import shutil
from typing import Optional, Dict, List
from datetime import datetime
import logging
from pathlib import Path
from .database import Database

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LocalStorage:
    def __init__(self):
        """Initialize local storage."""
        self.storage_dir = Path.home() / '.system_sync' / 'storage'
        self.db = Database()
        os.makedirs(self.storage_dir, exist_ok=True)

    def _get_storage_path(self, app_name: str, filename: str) -> str:
        """Get the storage path for a backup file."""
        return str(self.storage_dir / app_name / filename)

    async def upload_backup(self, 
                          app_name: str, 
                          file_path: str, 
                          metadata: Dict,
                          total_size: Optional[int] = None,
                          callback=None) -> Optional[str]:
        """Store backup in local storage and record in database."""
        try:
            logger.info(f"Starting backup upload for {app_name}")
            logger.info(f"File path: {file_path}")
            logger.info(f"Metadata: {metadata}")
            logger.info(f"Total size: {total_size}")
            
            file_name = os.path.basename(file_path)
            file_size = os.path.getsize(file_path)
            logger.info(f"Actual file size: {file_size}")
            
            # Verify file size matches expected size if provided
            if total_size and abs(file_size - total_size) > 1024:  # Allow 1KB difference
                logger.error(f"File size mismatch. Expected: {total_size}, Got: {file_size}")
                raise Exception("Backup file size does not match expected size")
            
            # Get or create application record
            app_data = {
                'name': app_name,
                'path': file_path,
                'category': metadata.get('category', 'Development'),
                'type': metadata.get('type', 'Application'),
                'size': file_size,
                'settings': metadata.get('settings', [])
            }
            logger.info(f"Creating application record with data: {app_data}")
            
            app = self.db.add_application(app_data)
            if not app:
                logger.error("Failed to create application record")
                raise Exception(f"Failed to create application record for {app_name}")

            # Create storage path
            storage_path = self._get_storage_path(app_name, file_name)
            logger.info(f"Storage path: {storage_path}")
            os.makedirs(os.path.dirname(storage_path), exist_ok=True)
            
            # Copy file to storage with progress tracking
            logger.info("Copying file to storage")
            try:
                with open(file_path, 'rb') as src, open(storage_path, 'wb') as dst:
                    # Copy in chunks to handle large files
                    chunk_size = 1024 * 1024  # 1MB chunks
                    copied = 0
                    while True:
                        chunk = src.read(chunk_size)
                        if not chunk:
                            break
                        dst.write(chunk)
                        copied += len(chunk)
                        if callback:
                            progress = (copied / file_size) * 100
                            callback(progress)
            except Exception as e:
                logger.error(f"Error copying file: {str(e)}")
                if os.path.exists(storage_path):
                    os.remove(storage_path)
                raise

            # Verify copied file size
            copied_size = os.path.getsize(storage_path)
            if copied_size != file_size:
                logger.error(f"Copied file size mismatch. Expected: {file_size}, Got: {copied_size}")
                os.remove(storage_path)
                raise Exception("Backup file was not copied correctly")

            # Create backup record
            backup_data = {
                'app_id': app['id'],
                'filename': file_name,
                'storage_path': storage_path,
                'size': file_size,
                'metadata': metadata
            }
            logger.info(f"Creating backup record with data: {backup_data}")

            backup = self.db.add_backup(backup_data)
            if not backup:
                logger.error("Failed to create backup record")
                if os.path.exists(storage_path):
                    os.remove(storage_path)
                return None
            
            logger.info("Backup upload completed successfully")
            return storage_path

        except Exception as e:
            logger.error(f"Error storing backup: {str(e)}")
            logger.exception("Full error details:")
            return None

    async def download_backup(self, 
                            storage_path: str, 
                            destination: str,
                            callback=None) -> bool:
        """Copy backup from local storage to destination."""
        try:
            # Ensure destination directory exists
            os.makedirs(os.path.dirname(destination), exist_ok=True)
            
            # Copy file to destination
            shutil.copy2(storage_path, destination)
            return True

        except Exception as e:
            logger.error(f"Error retrieving backup: {str(e)}")
            return False

    async def update_backup_restored(self, backup_id: int) -> bool:
        """Update backup restored timestamp."""
        try:
            logger.info(f"Updating backup {backup_id} as restored")
            return self.db.update_backup_restored(backup_id)
        except Exception as e:
            logger.error(f"Error updating backup restored status: {str(e)}")
            return False

    async def list_backups(self, app_name: Optional[str] = None) -> List[Dict]:
        """List available backups."""
        try:
            return self.db.get_backups()
        except Exception as e:
            logger.error(f"Error listing backups: {str(e)}")
            return []

    async def delete_backup(self, backup_id: int) -> bool:
        """Delete backup from storage and database."""
        try:
            # Get backup info
            backups = self.db.get_backups()
            backup = next((b for b in backups if b['id'] == backup_id), None)
            
            if not backup:
                return False

            # Delete file from storage
            if os.path.exists(backup['storage_path']):
                os.remove(backup['storage_path'])
            
            # Delete from database
            return self.db.delete_backup(backup_id)

        except Exception as e:
            logger.error(f"Error deleting backup: {str(e)}")
            return False

    async def get_storage_usage(self) -> Dict:
        """Get storage usage statistics."""
        try:
            backups = self.db.get_backups()
            total_size = sum(backup['size'] for backup in backups)
            backup_count = len(backups)
            
            return {
                'total_size': total_size,
                'backup_count': backup_count
            }

        except Exception as e:
            logger.error(f"Error getting storage usage: {str(e)}")
            return {'total_size': 0, 'backup_count': 0} 