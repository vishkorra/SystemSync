import click
import os
from pathlib import Path
from typing import List
from config_manager import ConfigManager
from app_handler import AppHandler

@click.group()
def cli():
    """Environment Sync Tool - Sync your development and application settings across computers."""
    pass

@cli.command()
def list_apps():
    """List all detected applications on the system."""
    app_handler = AppHandler()
    apps = app_handler.get_installed_apps()
    
    click.echo("Detected Applications:")
    for app in apps:
        click.echo(f"- {app['name']} ({app['type']})")
        
@cli.command()
@click.argument('app_name')
@click.option('--backup-dir', '-b', default=None, help='Custom backup directory')
def backup(app_name: str, backup_dir: str):
    """Backup settings for a specific application."""
    if backup_dir is None:
        backup_dir = str(Path.home() / '.env_sync' / 'backups')
        
    app_handler = AppHandler()
    config_manager = ConfigManager()
    
    click.echo(f"Backing up settings for {app_name}...")
    
    # Backup application settings
    backup_paths = app_handler.backup_app_settings(app_name, backup_dir)
    
    if backup_paths:
        config_manager.save_app_config(app_name, {
            "backup_paths": backup_paths,
            "backup_dir": backup_dir
        })
        click.echo(f"Successfully backed up {app_name} settings to {backup_dir}")
    else:
        click.echo(f"No settings found for {app_name}")
        
@cli.command()
@click.argument('app_name')
def restore(app_name: str):
    """Restore settings for a specific application."""
    config_manager = ConfigManager()
    app_handler = AppHandler()
    
    config = config_manager.load_app_config(app_name)
    if not config:
        click.echo(f"No backup found for {app_name}")
        return
        
    click.echo(f"Restoring settings for {app_name}...")
    success = app_handler.restore_app_settings(app_name, config["backup_dir"])
    
    if success:
        click.echo(f"Successfully restored {app_name} settings")
    else:
        click.echo(f"Failed to restore settings for {app_name}")
        
@cli.command()
def list_backups():
    """List all applications with backed up settings."""
    config_manager = ConfigManager()
    backups = config_manager.list_saved_configs()
    
    if backups:
        click.echo("Applications with backed up settings:")
        for app in backups:
            click.echo(f"- {app}")
    else:
        click.echo("No backups found")

if __name__ == '__main__':
    cli() 