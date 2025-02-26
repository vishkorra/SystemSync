import os
import json
import shutil
from pathlib import Path
from typing import Dict, List, Optional
import platform
import psutil

class AppHandler:
    def __init__(self):
        self.system = platform.system()
        self._init_app_paths()
        
    def _init_app_paths(self):
        """Initialize common application paths based on OS."""
        self.home = str(Path.home())
        if self.system == "Darwin":  # macOS
            self.app_support = os.path.join(self.home, "Library", "Application Support")
            self.preferences = os.path.join(self.home, "Library", "Preferences")
        elif self.system == "Windows":
            self.app_support = os.path.join(os.getenv("APPDATA", ""))
            self.preferences = self.app_support
        else:  # Linux
            self.app_support = os.path.join(self.home, ".config")
            self.preferences = self.app_support
            
    def get_installed_apps(self) -> List[Dict[str, str]]:
        """Get list of installed applications with their paths."""
        apps = []
        if self.system == "Darwin":
            apps.extend(self._get_macos_apps())
        elif self.system == "Windows":
            apps.extend(self._get_windows_apps())
        else:
            apps.extend(self._get_linux_apps())
        return apps
        
    def _get_macos_apps(self) -> List[Dict[str, str]]:
        """Get installed applications on macOS."""
        apps = []
        app_locations = [
            "/Applications",
            os.path.join(self.home, "Applications")
        ]
        
        for location in app_locations:
            if os.path.exists(location):
                for app in os.listdir(location):
                    if app.endswith(".app"):
                        apps.append({
                            "name": app.replace(".app", ""),
                            "path": os.path.join(location, app),
                            "type": "application"
                        })
        return apps
        
    def get_app_settings(self, app_name: str) -> Dict[str, str]:
        """Get settings and configuration paths for a specific application."""
        settings = {}
        
        # Check common locations
        app_support_path = os.path.join(self.app_support, app_name)
        if os.path.exists(app_support_path):
            settings["app_support"] = app_support_path
            
        pref_path = os.path.join(self.preferences, f"{app_name}.plist")
        if os.path.exists(pref_path):
            settings["preferences"] = pref_path
            
        # Add game-specific paths
        if self.system == "Windows":
            documents = os.path.join(os.path.expanduser("~"), "Documents")
            game_saves = os.path.join(documents, "My Games", app_name)
            if os.path.exists(game_saves):
                settings["game_saves"] = game_saves
                
        return settings
        
    def backup_app_settings(self, app_name: str, backup_dir: str) -> Dict[str, str]:
        """Backup application settings to specified directory."""
        settings = self.get_app_settings(app_name)
        backup_paths = {}
        
        for setting_type, path in settings.items():
            if os.path.exists(path):
                backup_path = os.path.join(backup_dir, app_name, setting_type)
                os.makedirs(os.path.dirname(backup_path), exist_ok=True)
                
                if os.path.isfile(path):
                    shutil.copy2(path, backup_path)
                else:
                    shutil.copytree(path, backup_path, dirs_exist_ok=True)
                    
                backup_paths[setting_type] = backup_path
                
        return backup_paths
        
    def restore_app_settings(self, app_name: str, backup_dir: str) -> bool:
        """Restore application settings from backup."""
        backup_path = os.path.join(backup_dir, app_name)
        if not os.path.exists(backup_path):
            return False
            
        settings = self.get_app_settings(app_name)
        
        for setting_type, path in settings.items():
            backup_setting_path = os.path.join(backup_path, setting_type)
            if os.path.exists(backup_setting_path):
                if os.path.exists(path):
                    if os.path.isfile(path):
                        os.remove(path)
                    else:
                        shutil.rmtree(path)
                        
                if os.path.isfile(backup_setting_path):
                    shutil.copy2(backup_setting_path, path)
                else:
                    shutil.copytree(backup_setting_path, path, dirs_exist_ok=True)
                    
        return True 