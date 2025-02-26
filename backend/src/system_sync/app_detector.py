import os
import platform
import json
from pathlib import Path
from typing import Dict, List, Optional
import plistlib
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AppDetector:
    def __init__(self):
        self.system = platform.system()
        self._init_paths()

    def _init_paths(self):
        """Initialize system-specific paths."""
        self.home = str(Path.home())
        
        if self.system == "Darwin":  # macOS
            self.app_locations = [
                "/Applications",
                os.path.join(self.home, "Applications")
            ]
            self.app_support = os.path.join(self.home, "Library", "Application Support")
            self.preferences = os.path.join(self.home, "Library", "Preferences")
        elif self.system == "Windows":
            self.app_locations = [
                os.path.join(os.environ.get("ProgramFiles", "C:\\Program Files")),
                os.path.join(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)"))
            ]
            self.app_support = os.path.join(os.environ.get("APPDATA", ""))
            self.preferences = self.app_support
        else:  # Linux
            self.app_locations = [
                "/usr/share/applications",
                os.path.join(self.home, ".local", "share", "applications")
            ]
            self.app_support = os.path.join(self.home, ".config")
            self.preferences = self.app_support

    def get_category(self, app_name: str, app_path: str) -> str:
        """Determine application category based on location and name."""
        app_name_lower = app_name.lower()
        
        # Development tools
        if any(term in app_name_lower for term in ['code', 'studio', 'intellij', 'eclipse', 'sublime', 'vim']):
            return 'Development'
        
        # Gaming
        if any(term in app_name_lower for term in ['steam', 'epic', 'battle.net', 'game', 'unity']):
            return 'Gaming'
        
        # Creative
        if any(term in app_name_lower for term in ['photoshop', 'illustrator', 'premiere', 'figma', 'sketch']):
            return 'Creative'
        
        # Productivity
        if any(term in app_name_lower for term in ['office', 'excel', 'word', 'powerpoint', 'slack', 'zoom']):
            return 'Productivity'
            
        return 'Other'

    def get_app_settings(self, app_name: str) -> List[Dict]:
        """Get all settings locations for an application."""
        settings = []
        
        # Check Application Support
        app_support_path = os.path.join(self.app_support, app_name)
        if os.path.exists(app_support_path):
            size = sum(f.stat().st_size for f in Path(app_support_path).rglob('*') if f.is_file())
            settings.append({
                "name": "Application Support",
                "path": app_support_path,
                "description": "Application data and configurations",
                "type": "data",
                "size": size
            })

        # Check Preferences
        if self.system == "Darwin":
            plist_path = os.path.join(self.preferences, f"{app_name}.plist")
            if os.path.exists(plist_path):
                settings.append({
                    "name": "Preferences",
                    "path": plist_path,
                    "description": "Application preferences and settings",
                    "type": "preferences",
                    "size": os.path.getsize(plist_path)
                })

        # Check for game saves
        if self.system == "Windows":
            documents = os.path.join(self.home, "Documents", "My Games", app_name)
            if os.path.exists(documents):
                size = sum(f.stat().st_size for f in Path(documents).rglob('*') if f.is_file())
                settings.append({
                    "name": "Game Saves",
                    "path": documents,
                    "description": "Game save files and configurations",
                    "type": "data",
                    "size": size
                })

        return settings

    def get_vscode_settings(self) -> Dict:
        """Get VSCode settings and paths."""
        if self.system == "Darwin":
            vscode_path = os.path.join(self.app_support, "Code")
            return {
                "name": "Visual Studio Code",
                "path": "/Applications/Visual Studio Code.app",
                "category": "Development",
                "type": "Application",
                "settings": [
                    {
                        "type": "userData",
                        "path": os.path.join(vscode_path, "User"),
                        "description": "User settings and configurations"
                    },
                    {
                        "type": "extensions",
                        "path": os.path.join(self.home, ".vscode", "extensions"),
                        "description": "Installed extensions"
                    },
                    {
                        "type": "extensionGlobalStorage",
                        "path": os.path.join(vscode_path, "User", "globalStorage"),
                        "description": "Extension global data"
                    },
                    {
                        "type": "workspaceStorage",
                        "path": os.path.join(vscode_path, "User", "workspaceStorage"),
                        "description": "Workspace-specific data"
                    }
                ]
            }
        # Add Windows and Linux paths if needed
        return None

    def detect_applications(self) -> List[Dict]:
        """Detect installed applications and their settings."""
        applications = []
        
        # Add VSCode if installed
        vscode = self.get_vscode_settings()
        if vscode:
            applications.append(vscode)
            
        # Add Chrome if installed
        chrome = self.get_chrome_settings()
        if chrome:
            applications.append(chrome)
            
        # Add other applications as needed
        
        return applications

    def get_chrome_settings(self) -> Dict:
        """Get Chrome settings and paths."""
        if self.system == "Darwin":
            chrome_path = os.path.join(self.app_support, "Google", "Chrome")
            if os.path.exists(chrome_path):
                return {
                    "name": "Google Chrome",
                    "path": "/Applications/Google Chrome.app",
                    "category": "Other",
                    "type": "Application",
                    "settings": [
                        {
                            "type": "profile",
                            "path": chrome_path,
                            "description": "User profile data"
                        }
                    ]
                }
        return None 