#!/usr/bin/env python3

import os
import sys
import json
import shutil
import platform
import subprocess
import tempfile
import zipfile
import requests
from pathlib import Path
import logging
from typing import Dict, List, Optional, Tuple, Any

logger = logging.getLogger(__name__)

class VSCodePackager:
    """
    Downloads VS Code, extracts user settings from a backup,
    merges them into the VS Code installation, and packages everything
    into a proper application format.
    """
    
    # VS Code download URLs
    VSCODE_DOWNLOAD_URLS = {
        "darwin": "https://code.visualstudio.com/sha/download?build=stable&os=darwin-universal",
        "darwin-arm64": "https://code.visualstudio.com/sha/download?build=stable&os=darwin-arm64",
        "windows": "https://code.visualstudio.com/sha/download?build=stable&os=win32-x64-user",
        "linux": "https://code.visualstudio.com/sha/download?build=stable&os=linux-x64"
    }
    
    def __init__(self, temp_dir: Optional[str] = None):
        """
        Initialize the VS Code packager.
        
        Args:
            temp_dir: Optional temporary directory to use for processing
        """
        self.system = platform.system().lower()
        self.arch = platform.machine().lower()
        
        # Set the download URL based on platform and architecture
        if self.system == "darwin" and "arm" in self.arch:
            self.download_url = self.VSCODE_DOWNLOAD_URLS["darwin-arm64"]
        else:
            self.download_url = self.VSCODE_DOWNLOAD_URLS.get(self.system)
            
        if not self.download_url:
            raise ValueError(f"Unsupported platform: {self.system}")
            
        # Create a temporary directory if not provided
        if temp_dir:
            self.temp_dir = temp_dir
            self.should_cleanup_temp = False
        else:
            self.temp_dir = tempfile.mkdtemp(prefix="vscode_packager_")
            self.should_cleanup_temp = True
            
        # Set platform-specific paths and variables
        if self.system == "darwin":
            self.vscode_app_name = "Visual Studio Code.app"
            self.settings_dir_template = "Library/Application Support/Code/User"
        elif self.system == "windows":
            self.vscode_app_name = "VSCode"
            self.settings_dir_template = "AppData/Roaming/Code/User"
        elif self.system == "linux":
            self.vscode_app_name = "code"
            self.settings_dir_template = ".config/Code/User"
        else:
            raise ValueError(f"Unsupported platform: {self.system}")
    
    def __del__(self):
        """Clean up temporary directory if needed"""
        if hasattr(self, 'should_cleanup_temp') and self.should_cleanup_temp and os.path.exists(self.temp_dir):
            try:
                shutil.rmtree(self.temp_dir)
            except Exception as e:
                logger.warning(f"Failed to clean up temporary directory: {e}")
    
    def download_vscode(self) -> str:
        """
        Download the latest version of VS Code.
        
        Returns:
            Path to the downloaded file
        """
        logger.info(f"Downloading VS Code from {self.download_url}")
        
        # Determine file extension based on platform
        if self.system == "darwin":
            file_ext = "zip"
        elif self.system == "windows":
            file_ext = "exe"
        else:
            file_ext = "tar.gz"
            
        download_path = os.path.join(self.temp_dir, f"vscode.{file_ext}")
        
        # Download the file
        response = requests.get(self.download_url, stream=True)
        response.raise_for_status()
        
        with open(download_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                
        logger.info(f"Downloaded VS Code to {download_path}")
        return download_path
    
    def extract_vscode(self, download_path: str) -> str:
        """
        Extract the downloaded VS Code package.
        
        Args:
            download_path: Path to the downloaded VS Code package
            
        Returns:
            Path to the extracted VS Code application
        """
        extract_dir = os.path.join(self.temp_dir, "vscode_extracted")
        os.makedirs(extract_dir, exist_ok=True)
        
        logger.info(f"Extracting VS Code to {extract_dir}")
        
        if self.system == "darwin":
            # Extract the zip file
            with zipfile.ZipFile(download_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
            
            # Return the path to the .app bundle
            app_path = os.path.join(extract_dir, self.vscode_app_name)
            
        elif self.system == "windows":
            # For Windows, we'll need to use the installer with silent options
            # or extract the installer using 7zip or similar
            # This is a simplified version
            app_path = download_path  # For Windows, we'll use the installer directly
            
        else:  # Linux
            # Extract the tar.gz file
            subprocess.run(["tar", "-xzf", download_path, "-C", extract_dir], check=True)
            
            # Return the path to the extracted directory
            app_path = os.path.join(extract_dir, "VSCode-linux-x64")
            
        logger.info(f"Extracted VS Code to {app_path}")
        return app_path
    
    def extract_settings_from_backup(self, backup_path: str) -> Dict[str, Any]:
        """
        Extract VS Code settings from a backup file.
        
        Args:
            backup_path: Path to the backup file or directory
            
        Returns:
            Dictionary containing settings, keybindings, snippets, and extensions
        """
        logger.info(f"Extracting settings from backup: {backup_path}")
        
        # Create a temporary directory for extraction
        extract_dir = os.path.join(self.temp_dir, "backup_extracted")
        os.makedirs(extract_dir, exist_ok=True)
        
        # Extract the backup if it's a zip file
        if backup_path.endswith('.zip'):
            with zipfile.ZipFile(backup_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
            backup_dir = extract_dir
        else:
            # Assume it's already a directory
            backup_dir = backup_path
            
        # Look for VS Code settings in the backup
        settings_dir = None
        
        # Try to find the settings directory in common locations
        for root, dirs, files in os.walk(backup_dir):
            if "settings.json" in files and "keybindings.json" in files:
                settings_dir = root
                break
                
            # Also check for the platform-specific path
            if self.settings_dir_template in root and "settings.json" in files:
                settings_dir = root
                break
                
        if not settings_dir:
            raise ValueError("Could not find VS Code settings in the backup")
            
        # Extract settings
        settings = {}
        keybindings = []
        snippets = {}
        extensions = []
        
        # Read settings.json
        settings_file = os.path.join(settings_dir, "settings.json")
        if os.path.exists(settings_file):
            with open(settings_file, 'r') as f:
                settings = json.load(f)
                
        # Read keybindings.json
        keybindings_file = os.path.join(settings_dir, "keybindings.json")
        if os.path.exists(keybindings_file):
            with open(keybindings_file, 'r') as f:
                keybindings = json.load(f)
                
        # Read snippets
        snippets_dir = os.path.join(settings_dir, "snippets")
        if os.path.exists(snippets_dir):
            for file in os.listdir(snippets_dir):
                if file.endswith(".json"):
                    with open(os.path.join(snippets_dir, file), 'r') as f:
                        snippets[file] = f.read()
                        
        # Look for extensions list
        extensions_file = os.path.join(settings_dir, "extensions.json")
        if os.path.exists(extensions_file):
            with open(extensions_file, 'r') as f:
                extensions_data = json.load(f)
                extensions = extensions_data.get("extensions", [])
        else:
            # Try to find extensions.txt
            for root, dirs, files in os.walk(backup_dir):
                if "extensions.txt" in files:
                    with open(os.path.join(root, "extensions.txt"), 'r') as f:
                        extensions = [line.strip() for line in f if line.strip()]
                    break
                    
        logger.info(f"Extracted settings: {len(settings)} settings, {len(keybindings)} keybindings, "
                   f"{len(snippets)} snippets, {len(extensions)} extensions")
                   
        return {
            "settings": settings,
            "keybindings": keybindings,
            "snippets": snippets,
            "extensions": extensions,
            "settings_dir": settings_dir
        }
    
    def merge_settings_into_vscode(self, vscode_path: str, settings_data: Dict[str, Any]) -> str:
        """
        Merge the extracted settings into the VS Code installation.
        
        Args:
            vscode_path: Path to the VS Code application
            settings_data: Dictionary containing settings, keybindings, snippets, and extensions
            
        Returns:
            Path to the modified VS Code application
        """
        logger.info(f"Merging settings into VS Code at {vscode_path}")
        
        # Create a directory for the packaged VS Code
        packaged_dir = os.path.join(self.temp_dir, "vscode_packaged")
        os.makedirs(packaged_dir, exist_ok=True)
        
        # Copy the VS Code application to the packaged directory
        if self.system == "darwin":
            packaged_app = os.path.join(packaged_dir, self.vscode_app_name)
            logger.info(f"Copying VS Code application to {packaged_app}")
            shutil.copytree(vscode_path, packaged_app, symlinks=True)
            
            # Create the user data directory within the app bundle
            # For macOS, we'll place settings in a location that VS Code will find on first launch
            user_data_dir = os.path.join(packaged_app, "Contents", "Resources", "app", "user-data-dir")
            os.makedirs(user_data_dir, exist_ok=True)
            
            # Create the settings directory
            settings_dir = os.path.join(user_data_dir, "User")
            os.makedirs(settings_dir, exist_ok=True)
            
            # Create the snippets directory
            snippets_dir = os.path.join(settings_dir, "snippets")
            os.makedirs(snippets_dir, exist_ok=True)
            
            # Create a script to install extensions on first launch
            extensions_script_dir = os.path.join(packaged_app, "Contents", "Resources", "app", "extensions")
            os.makedirs(extensions_script_dir, exist_ok=True)
            
            # Create a script that will run on first launch to install extensions
            extensions_script_path = os.path.join(extensions_script_dir, "install_extensions.sh")
            with open(extensions_script_path, 'w') as f:
                f.write("#!/bin/bash\n\n")
                f.write("# This script installs VS Code extensions on first launch\n\n")
                f.write("EXTENSIONS_FILE=\"$HOME/Library/Application Support/Code/User/extensions.json\"\n\n")
                f.write("# Check if extensions are already installed\n")
                f.write("if [ -f \"$EXTENSIONS_FILE\" ]; then\n")
                f.write("    echo \"Extensions already installed\"\n")
                f.write("    exit 0\n")
                f.write("fi\n\n")
                f.write("# Install extensions\n")
                f.write("echo \"Installing extensions...\"\n\n")
                
                for extension in settings_data["extensions"]:
                    f.write(f"\"$CODE_EXECUTABLE_PATH\" --install-extension \"{extension}\" || echo \"Failed to install {extension}\"\n")
                
                f.write("\necho \"Extensions installation complete\"\n")
            
            # Make the script executable
            os.chmod(extensions_script_path, 0o755)
            
            # Create a launcher script that will be executed when the app is opened
            launcher_script_path = os.path.join(packaged_app, "Contents", "Resources", "app", "launcher.sh")
            with open(launcher_script_path, 'w') as f:
                f.write("#!/bin/bash\n\n")
                f.write("# This script runs when VS Code is launched\n\n")
                f.write("# Set the path to the VS Code executable\n")
                f.write("export CODE_EXECUTABLE_PATH=\"$(dirname \"$0\")/../../MacOS/Electron\"\n\n")
                f.write("# Run the extensions installation script in the background\n")
                f.write("\"$(dirname \"$0\")/extensions/install_extensions.sh\" &\n\n")
                f.write("# Launch VS Code\n")
                f.write("exec \"$CODE_EXECUTABLE_PATH\" \"$@\"\n")
            
            # Make the launcher script executable
            os.chmod(launcher_script_path, 0o755)
            
            # Modify the Info.plist to run our launcher script
            info_plist_path = os.path.join(packaged_app, "Contents", "Info.plist")
            if os.path.exists(info_plist_path):
                try:
                    # This is a simplified approach - in a production environment,
                    # you would use a proper plist library to modify the file
                    with open(info_plist_path, 'r') as f:
                        info_plist_content = f.read()
                    
                    # Replace the Electron executable with our launcher script
                    info_plist_content = info_plist_content.replace(
                        "<string>Electron</string>",
                        "<string>Resources/app/launcher.sh</string>"
                    )
                    
                    with open(info_plist_path, 'w') as f:
                        f.write(info_plist_content)
                    
                    logger.info("Modified Info.plist to use custom launcher script")
                except Exception as e:
                    logger.error(f"Failed to modify Info.plist: {e}")
            
        elif self.system == "windows":
            # For Windows, we'll need a different approach
            # This is a simplified version
            packaged_app = os.path.join(packaged_dir, self.vscode_app_name)
            os.makedirs(packaged_app, exist_ok=True)
            
            # Copy the installer
            shutil.copy2(vscode_path, os.path.join(packaged_app, "VSCodeSetup.exe"))
            
            # Create the settings directory
            settings_dir = os.path.join(packaged_app, "data", "User")
            os.makedirs(settings_dir, exist_ok=True)
            
            # Create the snippets directory
            snippets_dir = os.path.join(settings_dir, "snippets")
            os.makedirs(snippets_dir, exist_ok=True)
            
        else:  # Linux
            packaged_app = os.path.join(packaged_dir, self.vscode_app_name)
            shutil.copytree(vscode_path, packaged_app)
            
            # Create the settings directory
            settings_dir = os.path.join(packaged_app, "data", "user-data", "User")
            os.makedirs(settings_dir, exist_ok=True)
            
            # Create the snippets directory
            snippets_dir = os.path.join(settings_dir, "snippets")
            os.makedirs(snippets_dir, exist_ok=True)
            
        # Write settings.json
        with open(os.path.join(settings_dir, "settings.json"), 'w') as f:
            json.dump(settings_data["settings"], f, indent=2)
            
        # Write keybindings.json
        with open(os.path.join(settings_dir, "keybindings.json"), 'w') as f:
            json.dump(settings_data["keybindings"], f, indent=2)
            
        # Write snippets
        for filename, content in settings_data["snippets"].items():
            with open(os.path.join(snippets_dir, filename), 'w') as f:
                f.write(content)
                
        # Write extensions list
        with open(os.path.join(settings_dir, "extensions.json"), 'w') as f:
            json.dump({"extensions": settings_data["extensions"]}, f, indent=2)
            
        logger.info(f"Settings merged into VS Code at {packaged_app}")
        return packaged_app
    
    def _create_setup_script(self, packaged_dir: str, settings_data: Dict[str, Any]) -> None:
        """
        Create a setup script that will install extensions and configure VS Code.
        
        Args:
            packaged_dir: Path to the packaged VS Code directory
            settings_data: Dictionary containing settings, keybindings, snippets, and extensions
        """
        if self.system == "darwin":
            script_path = os.path.join(packaged_dir, "setup.command")
            script_content = self._get_macos_setup_script(settings_data["extensions"])
        elif self.system == "windows":
            script_path = os.path.join(packaged_dir, "setup.bat")
            script_content = self._get_windows_setup_script(settings_data["extensions"])
        else:  # Linux
            script_path = os.path.join(packaged_dir, "setup.sh")
            script_content = self._get_linux_setup_script(settings_data["extensions"])
            
        with open(script_path, 'w') as f:
            f.write(script_content)
            
        # Make the script executable
        os.chmod(script_path, 0o755)
        
        logger.info(f"Created setup script at {script_path}")
    
    def _get_macos_setup_script(self, extensions: List[str]) -> str:
        """Get the macOS setup script content"""
        script = """#!/bin/bash

# VS Code Setup Script
echo "=== VS Code Setup with Custom Settings ==="
echo "This script will configure VS Code with your custom settings and extensions"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SETTINGS_DIR="$SCRIPT_DIR/VSCodeSettings"
VS_CODE_USER_DIR="$HOME/Library/Application Support/Code/User"

# Check if VS Code is installed
if ! command -v code &> /dev/null; then
    echo "VS Code is not installed. Downloading and installing..."
    # Download VS Code
    curl -L "https://code.visualstudio.com/sha/download?build=stable&os=darwin-universal" -o "$SCRIPT_DIR/VSCode.zip"
    
    # Extract VS Code
    unzip -q "$SCRIPT_DIR/VSCode.zip" -d "$SCRIPT_DIR"
    
    # Move to Applications
    echo "Moving VS Code to Applications folder..."
    mv "$SCRIPT_DIR/Visual Studio Code.app" "/Applications/"
    
    # Clean up
    rm "$SCRIPT_DIR/VSCode.zip"
    
    # Add to PATH
    echo 'export PATH="/Applications/Visual Studio Code.app/Contents/Resources/app/bin:$PATH"' >> ~/.zshrc
    echo 'export PATH="/Applications/Visual Studio Code.app/Contents/Resources/app/bin:$PATH"' >> ~/.bash_profile
    
    echo "VS Code installed successfully!"
else
    echo "VS Code is already installed."
fi

# Create VS Code user directory if it doesn't exist
mkdir -p "$VS_CODE_USER_DIR"
mkdir -p "$VS_CODE_USER_DIR/snippets"

# Copy settings
echo "Copying settings..."
cp "$SETTINGS_DIR/settings.json" "$VS_CODE_USER_DIR/"
cp "$SETTINGS_DIR/keybindings.json" "$VS_CODE_USER_DIR/"

# Copy snippets
echo "Copying snippets..."
cp -R "$SETTINGS_DIR/snippets/"* "$VS_CODE_USER_DIR/snippets/"

# Install extensions
echo "Installing extensions..."
"""

        for extension in extensions:
            script += f'code --install-extension "{extension}" || echo "Failed to install {extension}"\n'

        script += """
echo "=== Setup completed successfully! ==="
echo "VS Code is now configured with all your custom settings and extensions."
echo "Press any key to exit..."
read -n 1
"""
        return script
    
    def _get_windows_setup_script(self, extensions: List[str]) -> str:
        """Get the Windows setup script content"""
        script = """@echo off
echo === VS Code Setup with Custom Settings ===
echo This script will configure VS Code with your custom settings and extensions

set SCRIPT_DIR=%~dp0
set SETTINGS_DIR=%SCRIPT_DIR%VSCodeSettings
set VS_CODE_USER_DIR=%APPDATA%\\Code\\User

REM Check if VS Code is installed
where code >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo VS Code is not installed. Downloading and installing...
    
    REM Download VS Code
    powershell -Command "Invoke-WebRequest -Uri 'https://code.visualstudio.com/sha/download?build=stable&os=win32-x64-user' -OutFile '%SCRIPT_DIR%\\VSCodeSetup.exe'"
    
    REM Install VS Code
    echo Installing VS Code...
    start /wait %SCRIPT_DIR%\\VSCodeSetup.exe /verysilent /mergetasks=!runcode
    
    REM Clean up
    del %SCRIPT_DIR%\\VSCodeSetup.exe
    
    echo VS Code installed successfully!
) else (
    echo VS Code is already installed.
)

REM Create VS Code user directory if it doesn't exist
if not exist "%VS_CODE_USER_DIR%" mkdir "%VS_CODE_USER_DIR%"
if not exist "%VS_CODE_USER_DIR%\\snippets" mkdir "%VS_CODE_USER_DIR%\\snippets"

REM Copy settings
echo Copying settings...
copy "%SETTINGS_DIR%\\settings.json" "%VS_CODE_USER_DIR%\\" /Y
copy "%SETTINGS_DIR%\\keybindings.json" "%VS_CODE_USER_DIR%\\" /Y

REM Copy snippets
echo Copying snippets...
xcopy "%SETTINGS_DIR%\\snippets\\*" "%VS_CODE_USER_DIR%\\snippets\\" /E /Y

REM Install extensions
echo Installing extensions...
"""

        for extension in extensions:
            script += f'code --install-extension "{extension}" || echo "Failed to install {extension}"\n'

        script += """
echo === Setup completed successfully! ===
echo VS Code is now configured with all your custom settings and extensions.
echo Press any key to exit...
pause
"""
        return script
    
    def _get_linux_setup_script(self, extensions: List[str]) -> str:
        """Get the Linux setup script content"""
        script = """#!/bin/bash

# VS Code Setup Script
echo "=== VS Code Setup with Custom Settings ==="
echo "This script will configure VS Code with your custom settings and extensions"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SETTINGS_DIR="$SCRIPT_DIR/VSCodeSettings"
VS_CODE_USER_DIR="$HOME/.config/Code/User"

# Check if VS Code is installed
if ! command -v code &> /dev/null; then
    echo "VS Code is not installed. Downloading and installing..."
    
    # Detect package manager
    if command -v apt &> /dev/null; then
        # Debian/Ubuntu
        echo "Detected Debian/Ubuntu system"
        
        # Download VS Code
        wget -O "$SCRIPT_DIR/vscode.deb" "https://code.visualstudio.com/sha/download?build=stable&os=linux-deb-x64"
        
        # Install VS Code
        sudo apt install -y "$SCRIPT_DIR/vscode.deb"
        
        # Clean up
        rm "$SCRIPT_DIR/vscode.deb"
        
    elif command -v dnf &> /dev/null; then
        # Fedora/RHEL
        echo "Detected Fedora/RHEL system"
        
        # Download VS Code
        wget -O "$SCRIPT_DIR/vscode.rpm" "https://code.visualstudio.com/sha/download?build=stable&os=linux-rpm-x64"
        
        # Install VS Code
        sudo dnf install -y "$SCRIPT_DIR/vscode.rpm"
        
        # Clean up
        rm "$SCRIPT_DIR/vscode.rpm"
        
    else
        echo "Unsupported Linux distribution. Please install VS Code manually from https://code.visualstudio.com/"
        exit 1
    fi
    
    echo "VS Code installed successfully!"
else
    echo "VS Code is already installed."
fi

# Create VS Code user directory if it doesn't exist
mkdir -p "$VS_CODE_USER_DIR"
mkdir -p "$VS_CODE_USER_DIR/snippets"

# Copy settings
echo "Copying settings..."
cp "$SETTINGS_DIR/settings.json" "$VS_CODE_USER_DIR/"
cp "$SETTINGS_DIR/keybindings.json" "$VS_CODE_USER_DIR/"

# Copy snippets
echo "Copying snippets..."
cp -R "$SETTINGS_DIR/snippets/"* "$VS_CODE_USER_DIR/snippets/"

# Install extensions
echo "Installing extensions..."
"""

        for extension in extensions:
            script += f'code --install-extension "{extension}" || echo "Failed to install {extension}"\n'

        script += """
echo "=== Setup completed successfully! ==="
echo "VS Code is now configured with all your custom settings and extensions."
echo "Press any key to exit..."
read -n 1
"""
        return script
    
    def package_vscode(self, vscode_path: str) -> str:
        """
        Package the modified VS Code application.
        
        Args:
            vscode_path: Path to the modified VS Code application
            
        Returns:
            Path to the packaged VS Code application
        """
        logger.info(f"Packaging VS Code from {vscode_path}")
        
        output_dir = os.path.join(self.temp_dir, "output")
        os.makedirs(output_dir, exist_ok=True)
        
        if self.system == "darwin":
            # Create a DMG for macOS
            return self._create_macos_dmg(vscode_path, output_dir)
        elif self.system == "windows":
            # Create a ZIP for Windows
            return self._create_windows_package(vscode_path, output_dir)
        else:  # Linux
            # Create a tarball for Linux
            return self._create_linux_package(vscode_path, output_dir)
    
    def _create_macos_dmg(self, app_path: str, output_dir: str) -> str:
        """
        Create a DMG file for macOS that contains the VS Code application with settings already integrated.
        
        Args:
            app_path: Path to the VS Code application directory
            output_dir: Directory to save the DMG file
            
        Returns:
            Path to the created DMG file
        """
        dmg_path = os.path.join(output_dir, "VSCode_with_Settings.dmg")
        
        try:
            logger.info(f"Creating DMG from {app_path}")
            
            # Ensure the app_path exists and is a directory
            if not os.path.exists(app_path) or not os.path.isdir(app_path):
                logger.error(f"VS Code application path does not exist or is not a directory: {app_path}")
                return self._create_zip_package(app_path, output_dir)
            
            # Create a staging directory for the DMG contents
            staging_dir = os.path.join(self.temp_dir, "dmg_staging")
            os.makedirs(staging_dir, exist_ok=True)
            
            # Copy the VS Code application to the staging directory
            vscode_app_path = os.path.join(staging_dir, self.vscode_app_name)
            logger.info(f"Copying VS Code application to staging directory: {vscode_app_path}")
            shutil.copytree(app_path, vscode_app_path, symlinks=True)
            
            # Create a symbolic link to /Applications in the staging directory
            applications_link = os.path.join(staging_dir, "Applications")
            logger.info(f"Creating symbolic link to /Applications: {applications_link}")
            if not os.path.exists(applications_link):
                os.symlink("/Applications", applications_link)
            
            # Create a background image directory
            background_dir = os.path.join(staging_dir, ".background")
            os.makedirs(background_dir, exist_ok=True)
            
            # Create a simple README file with instructions
            readme_path = os.path.join(staging_dir, "README.txt")
            with open(readme_path, 'w') as f:
                f.write("Drag Visual Studio Code to the Applications folder to install.\n\n"
                        "This version of VS Code already includes your settings, keybindings, and snippets.\n"
                        "Your extensions will be automatically installed on first launch.")
            
            # Create a temporary DMG
            temp_dmg = os.path.join(self.temp_dir, "temp.dmg")
            logger.info(f"Creating temporary DMG at {temp_dmg}")
            
            # Use hdiutil to create the DMG
            create_cmd = [
                "hdiutil", "create",
                "-volname", "VS Code with Settings",
                "-srcfolder", staging_dir,
                "-ov", "-format", "UDRW",
                temp_dmg
            ]
            
            logger.info(f"Running command: {' '.join(create_cmd)}")
            result = subprocess.run(create_cmd, check=True, capture_output=True, text=True)
            logger.info(f"hdiutil create output: {result.stdout}")
            
            # Create a mount point for the DMG
            mount_point = os.path.join(self.temp_dir, "dmg_mount")
            os.makedirs(mount_point, exist_ok=True)
            
            # Mount the DMG to customize it
            mount_cmd = [
                "hdiutil", "attach", temp_dmg,
                "-mountpoint", mount_point,
                "-noautoopen"
            ]
            
            logger.info(f"Running command: {' '.join(mount_cmd)}")
            result = subprocess.run(mount_cmd, check=True, capture_output=True, text=True)
            logger.info(f"hdiutil attach output: {result.stdout}")
            
            try:
                # Create a .DS_Store file to customize the DMG window appearance
                # This is optional and can be expanded with more customization
                
                # Detach the DMG
                detach_cmd = ["hdiutil", "detach", mount_point, "-force"]
                logger.info(f"Running command: {' '.join(detach_cmd)}")
                result = subprocess.run(detach_cmd, check=True, capture_output=True, text=True)
                logger.info(f"hdiutil detach output: {result.stdout}")
            except Exception as e:
                logger.error(f"Error customizing DMG: {e}")
                # Try to detach if an error occurred
                try:
                    subprocess.run(["hdiutil", "detach", mount_point, "-force"], check=False)
                except:
                    pass
            
            # Convert the DMG to compressed format
            convert_cmd = [
                "hdiutil", "convert",
                temp_dmg,
                "-format", "UDZO",
                "-o", dmg_path
            ]
            
            logger.info(f"Running command: {' '.join(convert_cmd)}")
            result = subprocess.run(convert_cmd, check=True, capture_output=True, text=True)
            logger.info(f"hdiutil convert output: {result.stdout}")
            
            # Check if the final DMG was created
            if not os.path.exists(dmg_path):
                logger.error(f"Failed to create final DMG at {dmg_path}")
                return self._create_zip_package(app_path, output_dir)
            
            logger.info(f"Successfully created DMG at {dmg_path}")
            return dmg_path
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to create DMG: {e}")
            logger.error(f"Command output: {e.stdout if hasattr(e, 'stdout') else 'No output'}")
            logger.error(f"Command error: {e.stderr if hasattr(e, 'stderr') else 'No error'}")
            
            # Fall back to creating a ZIP file
            logger.info("Falling back to creating a ZIP file")
            return self._create_zip_package(app_path, output_dir)
        except Exception as e:
            logger.exception(f"Unexpected error creating DMG: {e}")
            return self._create_zip_package(app_path, output_dir)
        finally:
            # Clean up temporary DMG
            if os.path.exists(temp_dmg):
                try:
                    os.remove(temp_dmg)
                    logger.info(f"Removed temporary DMG: {temp_dmg}")
                except Exception as e:
                    logger.warning(f"Failed to remove temporary DMG: {e}")
    
    def _create_windows_package(self, app_path: str, output_dir: str) -> str:
        """
        Create a package for Windows.
        
        Args:
            app_path: Path to the VS Code application directory
            output_dir: Directory to save the package
            
        Returns:
            Path to the created package
        """
        # For Windows, we'll create a ZIP file
        return self._create_zip_package(app_path, output_dir)
    
    def _create_linux_package(self, app_path: str, output_dir: str) -> str:
        """
        Create a package for Linux.
        
        Args:
            app_path: Path to the VS Code application directory
            output_dir: Directory to save the package
            
        Returns:
            Path to the created package
        """
        # For Linux, we'll create a tarball
        tar_path = os.path.join(output_dir, "VSCode_with_Settings.tar.gz")
        
        try:
            subprocess.run([
                "tar", "-czf", tar_path, "-C", os.path.dirname(app_path), os.path.basename(app_path)
            ], check=True)
            
            logger.info(f"Created tarball at {tar_path}")
            return tar_path
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to create tarball: {e}")
            
            # Fall back to creating a ZIP file
            logger.info("Falling back to creating a ZIP file")
            return self._create_zip_package(app_path, output_dir)
    
    def _create_zip_package(self, app_path: str, output_dir: str) -> str:
        """
        Create a ZIP package.
        
        Args:
            app_path: Path to the VS Code application directory
            output_dir: Directory to save the ZIP file
            
        Returns:
            Path to the created ZIP file
        """
        zip_path = os.path.join(output_dir, "VSCode_with_Settings.zip")
        
        # Create a ZIP file
        shutil.make_archive(
            os.path.splitext(zip_path)[0],  # Remove .zip extension
            'zip',
            os.path.dirname(app_path),
            os.path.basename(app_path)
        )
        
        logger.info(f"Created ZIP at {zip_path}")
        return zip_path
    
    def create_vscode_package(self, backup_path: str) -> Tuple[str, str]:
        """
        Create a VS Code package with settings from a backup.
        
        Args:
            backup_path: Path to the backup file or directory
            
        Returns:
            Tuple of (path to the packaged VS Code application, file type)
        """
        try:
            logger.info(f"Starting VS Code packaging process for backup: {backup_path}")
            
            # Download VS Code
            logger.info("Downloading VS Code")
            vscode_download = self.download_vscode()
            
            # Extract VS Code
            logger.info("Extracting VS Code")
            vscode_path = self.extract_vscode(vscode_download)
            
            # Extract settings from backup
            logger.info("Extracting settings from backup")
            settings_data = self.extract_settings_from_backup(backup_path)
            
            # Merge settings into VS Code
            logger.info("Merging settings into VS Code")
            modified_vscode = self.merge_settings_into_vscode(vscode_path, settings_data)
            
            # Package VS Code
            logger.info("Packaging VS Code")
            package_path = self.package_vscode(modified_vscode)
            
            # Determine file type based on the package path
            if package_path.endswith('.dmg'):
                file_type = 'dmg'
            elif package_path.endswith('.zip'):
                file_type = 'zip'
            elif package_path.endswith('.tar.gz'):
                file_type = 'tar.gz'
            else:
                file_type = 'unknown'
            
            logger.info(f"VS Code package created successfully at {package_path} (type: {file_type})")
            return package_path, file_type
            
        except Exception as e:
            logger.exception(f"Failed to create VS Code package: {e}")
            raise 