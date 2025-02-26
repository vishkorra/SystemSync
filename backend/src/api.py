from fastapi import FastAPI, HTTPException, BackgroundTasks, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Optional
from pydantic import BaseModel
from system_sync.app_detector import AppDetector
from system_sync.backup_manager import BackupManager
from system_sync.vscode_packager import VSCodePackager
import logging
import json
import tempfile
import os
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
import platform
import shutil
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
app_detector = AppDetector()
backup_manager = BackupManager()

# Define the backups directory
BACKUPS_DIR = os.path.join(os.path.dirname(__file__), "backups")
os.makedirs(BACKUPS_DIR, exist_ok=True)

# Get allowed origins from environment variable or use defaults
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS", 
    "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003"
).split(",")

# Enable CORS with more permissive settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

class BackupRequest(BaseModel):
    app_name: str
    backup_dir: Optional[str] = None

class RestoreRequest(BaseModel):
    backup_id: int
    files: Optional[List[str]] = None

# Store progress information
progress_store: Dict[str, Dict] = {}

def update_progress(app_name: str, progress: float, status: str = "in-progress"):
    """Update progress information for an app."""
    progress_store[app_name] = {
        "progress": progress,
        "status": status
    }

@app.get("/apps")
async def list_applications() -> List[Dict]:
    """List all detected applications."""
    try:
        return app_detector.detect_applications()
    except Exception as e:
        logger.error(f"Error detecting applications: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to detect applications")

@app.post("/backup")
async def backup_app(
    request: BackupRequest,
    background_tasks: BackgroundTasks
) -> Dict:
    """Create a backup for an application"""
    try:
        # Get application settings
        apps = app_detector.detect_applications()
        app = next((a for a in apps if a["name"] == request.app_name), None)
        
        if not app:
            raise HTTPException(status_code=404, detail=f"Application {request.app_name} not found")
            
        if not app["settings"]:
            raise HTTPException(status_code=404, detail=f"No settings found for {request.app_name}")
            
        # Initialize progress
        update_progress(request.app_name, 0, "starting")
        
        # Start backup in background
        background_tasks.add_task(
            backup_manager.create_backup,
            request.app_name,
            app["settings"],
            lambda p: update_progress(request.app_name, p)
        )
        
        return {"status": "backup started"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating backup: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create backup")

@app.get("/backup/progress/{app_name}")
async def get_backup_progress(app_name: str) -> Dict:
    """Get backup progress for an application."""
    if app_name not in progress_store:
        raise HTTPException(status_code=404, detail="No backup in progress")
    return progress_store[app_name]

@app.get("/backups")
async def list_backups(app_name: Optional[str] = None) -> Dict:
    """List all backups."""
    try:
        return await backup_manager.list_backups(app_name)
    except Exception as e:
        logger.error(f"Error listing backups: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list backups")

@app.post("/restore")
async def restore_backup(request: RestoreRequest) -> Dict:
    """Restore a backup."""
    try:
        success = await backup_manager.restore_backup(
            request.backup_id,
            selected_files=request.files
        )
        if not success:
            raise HTTPException(status_code=404, detail="Backup not found or restore failed")
        return {"status": "restore completed"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restoring backup: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to restore backup")

@app.delete("/backup/{backup_id}")
async def delete_backup(backup_id: int) -> Dict:
    """Delete a backup."""
    try:
        success = await backup_manager.delete_backup(backup_id)
        if not success:
            raise HTTPException(status_code=404, detail="Backup not found")
        return {"status": "backup deleted"}
    except Exception as e:
        logger.error(f"Error deleting backup: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete backup")

@app.get("/backup/download/{backup_id}")
async def download_backup(backup_id: int):
    """Download a backup file."""
    try:
        # Get backup information
        backups = await backup_manager.list_backups()
        all_backups = []
        for app_backups in backups.values():
            all_backups.extend(app_backups)
        
        backup_info = next((b for b in all_backups if b['id'] == backup_id), None)
        
        if not backup_info:
            logger.error(f"Backup with ID {backup_id} not found")
            raise HTTPException(status_code=404, detail="Backup not found")
        
        # Create temporary file for downloaded backup
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_file:
            temp_path = temp_file.name
        
        # Download backup to temporary file
        logger.info(f"Downloading backup from {backup_info['storage_path']} to {temp_path}")
        success = await backup_manager.storage.download_backup(
            backup_info['storage_path'],
            temp_path
        )
        
        if not success:
            logger.error("Failed to download backup file")
            raise HTTPException(status_code=500, detail="Failed to download backup file")
        
        # Return the file as a response
        filename = backup_info['filename']
        return FileResponse(
            path=temp_path, 
            filename=filename,
            media_type="application/zip",
            background=BackgroundTasks().add_task(lambda: os.remove(temp_path))
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading backup: {str(e)}")
        logger.exception("Full error details:")
        raise HTTPException(status_code=500, detail=f"Failed to download backup: {str(e)}")

@app.post("/backup/upload")
async def upload_backup(
    file: UploadFile = File(...),
    app_name: str = Form(...),
    metadata: str = Form(...)
) -> Dict:
    """Handle backup file upload"""
    try:
        logger.info(f"Starting backup upload for {app_name}")
        
        # Parse metadata
        try:
            metadata_dict = json.loads(metadata)
            logger.info(f"Parsed metadata: {metadata_dict}")
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse metadata: {e}")
            raise HTTPException(
                status_code=400,
                detail="Invalid metadata format"
            )
        
        # Save file to temporary location
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_file:
                content = await file.read()
                temp_file.write(content)
                temp_path = temp_file.name
                logger.info(f"Saved temporary file to: {temp_path}")
                logger.info(f"File size: {len(content)} bytes")
        except Exception as e:
            logger.error(f"Failed to save temporary file: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to save uploaded file: {str(e)}"
            )

        try:
            # Store backup using local storage
            storage_path = await backup_manager.storage.upload_backup(
                app_name,
                temp_path,
                metadata_dict,
                total_size=os.path.getsize(temp_path)
            )

            if not storage_path:
                logger.error("Failed to store backup")
                raise HTTPException(
                    status_code=500,
                    detail="Failed to store backup in the system"
                )

            return {"status": "backup created", "path": storage_path}
        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.remove(temp_path)
                logger.info("Cleaned up temporary file")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error handling backup upload: {str(e)}")
        logger.exception("Full error details:")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process backup: {str(e)}"
        )

@app.get("/backup/package-vscode/{backup_id}")
async def package_vscode(backup_id: int):
    """Create a packaged VS Code with user settings from a backup."""
    try:
        # Get backup information
        backups = await backup_manager.list_backups()
        all_backups = []
        for app_backups in backups.values():
            all_backups.extend(app_backups)
        
        backup_info = next((b for b in all_backups if b['id'] == backup_id), None)
        
        if not backup_info:
            logger.error(f"Backup with ID {backup_id} not found")
            raise HTTPException(status_code=404, detail="Backup not found")
            
        # Check if this is a VS Code backup
        if backup_info.get('app_name', '').lower() != 'vscode':
            logger.error(f"Backup ID {backup_id} is not a VS Code backup")
            raise HTTPException(status_code=400, detail="Not a VS Code backup")
        
        # Create temporary file for downloaded backup
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_file:
            temp_path = temp_file.name
        
        # Download backup to temporary file
        logger.info(f"Downloading backup from {backup_info['storage_path']} to {temp_path}")
        success = await backup_manager.storage.download_backup(
            backup_info['storage_path'],
            temp_path
        )
        
        if not success:
            logger.error("Failed to download backup file")
            raise HTTPException(status_code=500, detail="Failed to download backup file")
        
        # Determine the appropriate output format based on platform
        system = platform.system()
        if system == "Darwin":
            # On macOS, create a DMG file
            output_filename = f"VSCode_with_Settings_{backup_id}.dmg"
            media_type = "application/x-apple-diskimage"
        elif system == "Windows":
            # On Windows, we would create an executable installer
            # For now, we'll return an error since it's not implemented
            os.remove(temp_path)
            raise HTTPException(status_code=501, detail="Windows packaging not implemented yet")
        else:
            # For other platforms, we'll return an error since it's not implemented
            os.remove(temp_path)
            raise HTTPException(status_code=501, detail="Packaging not implemented for this platform")
        
        # Create output path for packaged VS Code
        output_dir = os.path.join(tempfile.gettempdir(), "vscode_packages")
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, output_filename)
        
        # Create packaged VS Code
        packager = VSCodePackager()
        success = await packager.create_package(temp_path, output_path)
        
        # Clean up temporary backup file
        os.remove(temp_path)
        
        if not success:
            logger.error("Failed to create packaged VS Code")
            raise HTTPException(status_code=500, detail="Failed to create packaged VS Code")
        
        # Return the packaged VS Code as a response
        return FileResponse(
            path=output_path, 
            filename=output_filename,
            media_type=media_type,
            background=BackgroundTasks().add_task(lambda: os.remove(output_path))
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error packaging VS Code: {str(e)}")
        logger.exception("Full error details:")
        raise HTTPException(status_code=500, detail=f"Failed to package VS Code: {str(e)}")

@app.get("/api/backups/{backup_id}/package-vscode")
async def package_vscode(backup_id: str):
    """
    Package VS Code with settings from a backup.
    
    Args:
        backup_id: ID of the backup to use
        
    Returns:
        StreamingResponse with the packaged VS Code application
    """
    try:
        logger.info(f"Received request to package VS Code with backup ID: {backup_id}")
        
        # Define the backups directory
        BACKUPS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backups")
        logger.info(f"Backups directory: {BACKUPS_DIR}")
        
        # Get the backup file path
        backup_path = os.path.join(BACKUPS_DIR, f"{backup_id}.zip")
        logger.info(f"Backup file path: {backup_path}")
        
        # Check if the backup file exists
        if not os.path.exists(backup_path):
            logger.error(f"Backup file not found: {backup_path}")
            return JSONResponse(
                status_code=404,
                content={"success": False, "error": f"Backup with ID {backup_id} not found"}
            )
        
        logger.info(f"Packaging VS Code with settings from backup: {backup_id}")
        
        # Create a VS Code packager
        packager = VSCodePackager()
        
        # Create the package
        package_path, file_type = packager.create_vscode_package(backup_path)
        logger.info(f"Package created at: {package_path}, type: {file_type}")
        
        # Set the appropriate media type based on file type
        if file_type == 'dmg':
            media_type = "application/x-apple-diskimage"
            filename = f"VSCode_with_Settings.dmg"
        elif file_type == 'zip':
            media_type = "application/zip"
            filename = f"VSCode_with_Settings.zip"
        elif file_type == 'tar.gz':
            media_type = "application/gzip"
            filename = f"VSCode_with_Settings.tar.gz"
        else:
            media_type = "application/octet-stream"
            filename = f"VSCode_with_Settings.{file_type}"
        
        logger.info(f"Returning {file_type} package: {package_path} with media type: {media_type}")
        
        # Check if the package file exists
        if not os.path.exists(package_path):
            logger.error(f"Package file not found: {package_path}")
            return JSONResponse(
                status_code=500,
                content={"success": False, "error": f"Failed to create package file"}
            )
        
        # Return the package as a streaming response
        return StreamingResponse(
            open(package_path, "rb"),
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        logger.exception(f"Error packaging VS Code: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": f"Failed to package VS Code: {str(e)}"}
        )

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {"status": "healthy", "version": "1.0.0"} 