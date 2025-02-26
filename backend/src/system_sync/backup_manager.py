import os
import shutil
import json
import zipfile
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import logging
from .local_storage import LocalStorage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BackupManager:
    def __init__(self, backup_dir: Optional[str] = None):
        self.backup_dir = backup_dir or str(Path.home() / '.system_sync' / 'backups')
        self.storage = LocalStorage()
        os.makedirs(self.backup_dir, exist_ok=True)

    async def create_backup(self, app_name: str, settings: List[Dict], callback=None) -> bool:
        """Create a backup of application settings."""
        try:
            logger.info(f"Starting backup creation for {app_name}")
            logger.info(f"Settings to backup: {settings}")
            
            # Filter out non-existent paths
            valid_settings = [
                setting for setting in settings 
                if os.path.exists(setting['path'])
            ]
            
            if not valid_settings:
                logger.warning("No valid settings paths found to backup")
                return False
                
            logger.info(f"Valid settings to backup: {valid_settings}")
            
            # Calculate total size before backup
            total_size = 0
            for setting in valid_settings:
                setting_path = setting['path']
                if os.path.isfile(setting_path):
                    total_size += os.path.getsize(setting_path)
                else:
                    total_size += sum(f.stat().st_size for f in Path(setting_path).rglob('*') if f.is_file())
                setting['size'] = total_size  # Store size in setting metadata
            
            logger.info(f"Total size to backup: {total_size} bytes")
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_path = os.path.join(self.backup_dir, f"{app_name}_{timestamp}.zip")
            logger.info(f"Backup will be stored at: {backup_path}")
            
            # Create a temporary directory for collecting files
            with tempfile.TemporaryDirectory() as temp_dir:
                logger.info(f"Created temporary directory: {temp_dir}")
                total_files = sum(1 for setting in valid_settings for _ in Path(setting['path']).rglob('*') if _.is_file())
                logger.info(f"Total files to backup: {total_files}")
                processed_files = 0
                
                # Copy files to temporary directory
                for setting in valid_settings:
                    setting_path = setting['path']
                    logger.info(f"Processing setting path: {setting_path}")

                    relative_path = os.path.join(temp_dir, setting['type'], os.path.basename(setting_path))
                    logger.info(f"Copying to relative path: {relative_path}")
                    
                    try:
                        if os.path.isfile(setting_path):
                            os.makedirs(os.path.dirname(relative_path), exist_ok=True)
                            shutil.copy2(setting_path, relative_path)
                            processed_files += 1
                            if callback:
                                callback(processed_files / total_files * 50)  # First 50% for copying
                        else:
                            for root, _, files in os.walk(setting_path):
                                for file in files:
                                    src_file = os.path.join(root, file)
                                    rel_path = os.path.relpath(src_file, setting_path)
                                    dst_file = os.path.join(relative_path, rel_path)
                                    os.makedirs(os.path.dirname(dst_file), exist_ok=True)
                                    shutil.copy2(src_file, dst_file)
                                    processed_files += 1
                                    if callback:
                                        callback(processed_files / total_files * 50)
                    except Exception as e:
                        logger.warning(f"Error copying {setting_path}: {str(e)}")
                        continue

                logger.info(f"Processed {processed_files} files")

                if processed_files == 0:
                    logger.warning("No files were processed")
                    return False

                # Create zip archive
                logger.info("Creating zip archive")
                with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                    for root, _, files in os.walk(temp_dir):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_path, temp_dir)
                            zipf.write(file_path, arcname)

            if callback:
                callback(75)  # 75% after creating zip

            # Store in local storage
            logger.info("Storing backup in local storage")
            metadata = {
                'timestamp': timestamp,
                'settings': valid_settings,  # Now includes accurate sizes
                'app_name': app_name,
                'total_size': total_size
            }
            
            storage_path = await self.storage.upload_backup(
                app_name,
                backup_path,
                metadata,
                total_size  # Pass total size to storage
            )
            
            if not storage_path:
                logger.error("Failed to store backup in local storage")
                raise Exception("Failed to store backup")

            if callback:
                callback(100)

            logger.info("Backup creation completed successfully")
            return True

        except Exception as e:
            logger.error(f"Error creating backup for {app_name}: {str(e)}")
            logger.exception("Full error details:")
            return False
        finally:
            # Clean up local backup file
            if os.path.exists(backup_path):
                os.remove(backup_path)
                logger.info("Cleaned up temporary backup file")

    async def restore_backup(self, backup_id: int, selected_files: Optional[List[str]] = None, callback=None) -> bool:
        """Restore application settings from backup."""
        try:
            # Get backup information
            backups = await self.storage.list_backups()
            backup_info = next((b for b in backups if b['id'] == backup_id), None)
            
            if not backup_info:
                logger.error(f"Backup with ID {backup_id} not found")
                return False

            logger.info(f"Starting restore of backup ID {backup_id}: {backup_info['filename']}")

            # Create temporary file for downloaded backup
            with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_file:
                temp_path = temp_file.name

            # Download backup
            logger.info(f"Downloading backup from {backup_info['storage_path']} to {temp_path}")
            success = await self.storage.download_backup(
                backup_info['storage_path'],
                temp_path
            )
            
            if not success:
                logger.error("Failed to download backup file")
                return False

            if callback:
                callback(25)  # 25% after download

            # Create temporary directory for extraction
            with tempfile.TemporaryDirectory() as extract_dir:
                # Extract backup
                logger.info(f"Extracting backup to {extract_dir}")
                try:
                    with zipfile.ZipFile(temp_path, 'r') as zipf:
                        zipf.extractall(extract_dir)
                except Exception as e:
                    logger.error(f"Error extracting backup: {str(e)}")
                    return False

                if callback:
                    callback(50)  # 50% after extraction

                # List extracted contents for debugging
                logger.info("Extracted contents:")
                for root, dirs, files in os.walk(extract_dir):
                    for d in dirs:
                        logger.info(f"Directory: {os.path.join(root, d)}")
                    for f in files:
                        logger.info(f"File: {os.path.join(root, f)}")

                # Restore files
                settings = backup_info['metadata']['settings']
                total_settings = len(settings)
                
                for i, setting in enumerate(settings, 1):
                    setting_path = setting['path']
                    setting_type = setting['type']
                    
                    # Skip if not in selected files (if specified)
                    if selected_files and setting_path not in selected_files:
                        logger.info(f"Skipping {setting_path} (not selected)")
                        continue
                    
                    # Determine source path based on setting type
                    # The directory structure in the backup is organized by setting type
                    source_path = os.path.join(extract_dir, setting_type)
                    
                    logger.info(f"Restoring {setting_type} from {source_path} to {setting_path}")
                    
                    try:
                        if os.path.isfile(source_path):
                            # Ensure target directory exists
                            os.makedirs(os.path.dirname(setting_path), exist_ok=True)
                            shutil.copy2(source_path, setting_path)
                            logger.info(f"Restored file: {setting_path}")
                        elif os.path.isdir(source_path):
                            # Copy directory recursively
                            shutil.copytree(source_path, setting_path, dirs_exist_ok=True)
                            logger.info(f"Restored directory: {setting_path}")
                        else:
                            logger.warning(f"Source path not found: {source_path}")
                    except Exception as e:
                        logger.error(f"Error restoring {setting_path}: {str(e)}")

                    if callback:
                        callback(50 + (i / total_settings * 50))  # Last 50% for restoring

                # Update backup record
                try:
                    await self.storage.update_backup_restored(backup_id)
                    logger.info(f"Updated backup {backup_id} as restored")
                except Exception as e:
                    logger.error(f"Error updating backup restored status: {str(e)}")

                # Cleanup
                os.remove(temp_path)
                logger.info("Restore completed successfully")

                return True

        except Exception as e:
            logger.error(f"Error restoring backup: {str(e)}")
            logger.exception("Full error details:")
            return False

    async def list_backups(self, app_name: Optional[str] = None) -> Dict:
        """List available backups."""
        try:
            backups = await self.storage.list_backups(app_name)
            
            # Organize backups by app name
            organized = {}
            for backup in backups:
                app = backup['app_name']
                if app not in organized:
                    organized[app] = []
                organized[app].append({
                    'id': backup['id'],
                    'timestamp': backup['metadata']['timestamp'],
                    'size': backup['size'],
                    'created_at': backup['created_at'],
                    'storage_path': backup['storage_path'],
                    'filename': backup['filename'],
                    'settings': backup['metadata']['settings']
                })
                
            return organized if not app_name else {app_name: organized.get(app_name, [])}

        except Exception as e:
            logger.error(f"Error listing backups: {str(e)}")
            return {}

    async def delete_backup(self, backup_id: int) -> bool:
        """Delete a backup."""
        try:
            return await self.storage.delete_backup(backup_id)
        except Exception as e:
            logger.error(f"Error deleting backup: {str(e)}")
            return False 