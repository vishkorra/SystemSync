"""
System Sync Core Components
This package contains the core functionality for detecting applications,
managing backups, and handling cloud storage operations.
"""

from .app_detector import AppDetector
from .backup_manager import BackupManager
from .local_storage import LocalStorage

__all__ = ['AppDetector', 'BackupManager', 'LocalStorage']
