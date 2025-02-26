import sqlite3
import os
from pathlib import Path
from typing import Dict, List, Optional
import json
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class Database:
    def __init__(self, db_path: Optional[str] = None):
        """Initialize database connection."""
        if not db_path:
            db_dir = Path.home() / '.system_sync' / 'data'
            os.makedirs(db_dir, exist_ok=True)
            db_path = db_dir / 'system_sync.db'
        
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Initialize database tables."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            # Create applications table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS applications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    path TEXT NOT NULL,
                    category TEXT NOT NULL,
                    type TEXT NOT NULL,
                    size INTEGER NOT NULL,
                    settings TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(path)
                )
            ''')

            # Create backups table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS backups (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    app_id INTEGER NOT NULL,
                    filename TEXT NOT NULL,
                    storage_path TEXT NOT NULL,
                    size INTEGER NOT NULL,
                    metadata TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    restored_at TIMESTAMP,
                    FOREIGN KEY (app_id) REFERENCES applications(id),
                    UNIQUE(storage_path)
                )
            ''')

            conn.commit()

    def dict_factory(self, cursor: sqlite3.Cursor, row: tuple) -> Dict:
        """Convert SQL row to dictionary."""
        d = {}
        for idx, col in enumerate(cursor.description):
            d[col[0]] = row[idx]
        return d

    def get_applications(self) -> List[Dict]:
        """Get all applications."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = self.dict_factory
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM applications ORDER BY name')
            apps = cursor.fetchall()
            
            # Parse JSON settings
            for app in apps:
                if app['settings']:
                    app['settings'] = json.loads(app['settings'])
            
            return apps

    def add_application(self, app_data: Dict) -> Optional[Dict]:
        """Add a new application."""
        try:
            logger.info(f"Adding application to database: {app_data}")
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = self.dict_factory
                cursor = conn.cursor()
                
                # Convert settings to JSON string if present
                if 'settings' in app_data and app_data['settings']:
                    app_data['settings'] = json.dumps(app_data['settings'])

                # Check if application already exists
                cursor.execute('''
                    SELECT * FROM applications 
                    WHERE name = ? AND path = ?
                ''', (app_data['name'], app_data['path']))
                
                existing_app = cursor.fetchone()
                if existing_app:
                    logger.info("Application already exists, updating record")
                    cursor.execute('''
                        UPDATE applications 
                        SET category = ?, type = ?, size = ?, settings = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE name = ? AND path = ?
                    ''', (
                        app_data['category'],
                        app_data['type'],
                        app_data['size'],
                        app_data['settings'],
                        app_data['name'],
                        app_data['path']
                    ))
                    app_id = existing_app['id']
                else:
                    logger.info("Creating new application record")
                    cursor.execute('''
                        INSERT INTO applications (name, path, category, type, size, settings)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (
                        app_data['name'],
                        app_data['path'],
                        app_data['category'],
                        app_data['type'],
                        app_data['size'],
                        app_data['settings']
                    ))
                    app_id = cursor.lastrowid

                # Get the application record
                cursor.execute('SELECT * FROM applications WHERE id = ?', (app_id,))
                app = cursor.fetchone()
                
                # Parse JSON settings in response
                if app and app['settings']:
                    try:
                        app['settings'] = json.loads(app['settings'])
                    except json.JSONDecodeError:
                        logger.warning("Failed to parse settings JSON, returning as string")
                
                logger.info(f"Successfully added/updated application: {app}")
                return app

        except sqlite3.Error as e:
            logger.error(f"Database error while adding application: {str(e)}")
            logger.exception("Full error details:")
            return None
        except Exception as e:
            logger.error(f"Unexpected error while adding application: {str(e)}")
            logger.exception("Full error details:")
            return None

    def get_backups(self, app_id: Optional[int] = None) -> List[Dict]:
        """Get all backups, optionally filtered by app_id."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = self.dict_factory
            cursor = conn.cursor()
            
            if app_id:
                cursor.execute('''
                    SELECT b.*, a.name as app_name 
                    FROM backups b
                    JOIN applications a ON b.app_id = a.id
                    WHERE app_id = ?
                    ORDER BY created_at DESC
                ''', (app_id,))
            else:
                cursor.execute('''
                    SELECT b.*, a.name as app_name 
                    FROM backups b
                    JOIN applications a ON b.app_id = a.id
                    ORDER BY created_at DESC
                ''')
            
            backups = cursor.fetchall()
            
            # Parse JSON metadata
            for backup in backups:
                if backup['metadata']:
                    backup['metadata'] = json.loads(backup['metadata'])
            
            return backups

    def add_backup(self, backup_data: Dict) -> Optional[Dict]:
        """Add a new backup."""
        try:
            logger.info(f"Adding backup to database: {backup_data}")
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = self.dict_factory
                cursor = conn.cursor()
                
                # Convert metadata to JSON string
                if 'metadata' in backup_data and backup_data['metadata']:
                    backup_data['metadata'] = json.dumps(backup_data['metadata'])
                    logger.info("Converted metadata to JSON string")

                logger.info("Inserting backup record")
                cursor.execute('''
                    INSERT INTO backups (app_id, filename, storage_path, size, metadata)
                    VALUES (:app_id, :filename, :storage_path, :size, :metadata)
                ''', backup_data)
                
                # Get the inserted backup
                logger.info("Retrieving inserted backup record")
                cursor.execute('''
                    SELECT b.*, a.name as app_name 
                    FROM backups b
                    JOIN applications a ON b.app_id = a.id
                    WHERE b.id = ?
                ''', (cursor.lastrowid,))
                
                backup = cursor.fetchone()
                
                # Parse JSON metadata in response
                if backup and backup['metadata']:
                    try:
                        backup['metadata'] = json.loads(backup['metadata'])
                        logger.info("Successfully parsed backup metadata")
                    except json.JSONDecodeError as e:
                        logger.warning(f"Failed to parse backup metadata: {e}")
                
                logger.info(f"Successfully created backup record: {backup}")
                return backup

        except sqlite3.IntegrityError as e:
            logger.error(f"Database integrity error while adding backup: {str(e)}")
            logger.exception("Full error details:")
            return None
        except sqlite3.Error as e:
            logger.error(f"Database error while adding backup: {str(e)}")
            logger.exception("Full error details:")
            return None
        except Exception as e:
            logger.error(f"Unexpected error while adding backup: {str(e)}")
            logger.exception("Full error details:")
            return None

    def update_backup_restored(self, backup_id: int) -> bool:
        """Update backup restored timestamp."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE backups 
                    SET restored_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (backup_id,))
                conn.commit()
                return True
        except sqlite3.Error:
            return False

    def delete_backup(self, backup_id: int) -> bool:
        """Delete a backup."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM backups WHERE id = ?', (backup_id,))
                conn.commit()
                return cursor.rowcount > 0
        except sqlite3.Error:
            return False 