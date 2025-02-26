# VS Code Packaging Functionality

This module provides functionality to package VS Code with user settings into a distributable format.

## Overview

The `VSCodePackager` class in `vscode_packager.py` handles the following tasks:

1. Downloads the latest version of VS Code for the user's platform
2. Extracts user settings from a backup
3. Merges these settings into the VS Code installation
4. Packages everything into a proper application format:
   - DMG for macOS
   - ZIP for Windows
   - TAR.GZ for Linux

## Usage

### API Endpoint

The system provides an API endpoint to package VS Code:

```
GET /api/backups/{backup_id}/package-vscode
```

This endpoint takes a backup ID, uses the `VSCodePackager` to create a packaged VS Code application, and returns a download URL.

### Frontend Integration

The frontend provides a "Download VS Code App" button for VS Code backups, which triggers the packaging process and downloads the resulting package.

### Testing

You can test the VS Code packager using the `test_vscode_packager.py` script:

```bash
./test_vscode_packager.py /path/to/backup.zip --output-dir ./output
```

## Implementation Details

### Platform-Specific Packaging

- **macOS**: Creates a DMG file containing the VS Code.app bundle with embedded settings
- **Windows**: Creates a ZIP file containing the VS Code installer and a setup script
- **Linux**: Creates a TAR.GZ file containing the VS Code binaries and a setup script

### Settings Integration

The packager extracts the following from the backup:

- `settings.json`: User preferences
- `keybindings.json`: Custom keyboard shortcuts
- `snippets/`: Code snippets
- Extensions list: All installed extensions

These settings are integrated into the VS Code package, and a setup script is included to install extensions when the user runs the package.

## Requirements

- Python 3.6+
- `requests` library for downloading VS Code
- Platform-specific tools:
  - macOS: `hdiutil` for creating DMG files
  - Windows: None (uses built-in ZIP functionality)
  - Linux: `tar` for creating tarballs 