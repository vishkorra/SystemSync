import os
import yaml
from typing import Dict, Any, List
from pathlib import Path

class ConfigManager:
    def __init__(self, config_dir: str = None):
        self.config_dir = config_dir or str(Path.home() / '.env_sync' / 'configs')
        os.makedirs(self.config_dir, exist_ok=True)
        
    def save_app_config(self, app_name: str, config: Dict[str, Any]) -> None:
        """Save application configuration to a YAML file."""
        config_path = os.path.join(self.config_dir, f"{app_name}.yaml")
        with open(config_path, 'w') as f:
            yaml.safe_dump(config, f)
            
    def load_app_config(self, app_name: str) -> Dict[str, Any]:
        """Load application configuration from YAML file."""
        config_path = os.path.join(self.config_dir, f"{app_name}.yaml")
        if not os.path.exists(config_path):
            return {}
        with open(config_path, 'r') as f:
            return yaml.safe_load(f)
            
    def list_saved_configs(self) -> List[str]:
        """List all saved application configurations."""
        return [f.replace('.yaml', '') for f in os.listdir(self.config_dir)
                if f.endswith('.yaml')]
                
    def delete_app_config(self, app_name: str) -> None:
        """Delete an application's saved configuration."""
        config_path = os.path.join(self.config_dir, f"{app_name}.yaml")
        if os.path.exists(config_path):
            os.remove(config_path) 