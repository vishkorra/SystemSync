#!/usr/bin/env python3

import os
import sys
import argparse
import logging
from system_sync.vscode_packager import VSCodePackager

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description='Test VS Code packager')
    parser.add_argument('backup_path', help='Path to the backup file or directory')
    parser.add_argument('--output-dir', '-o', help='Output directory for the packaged VS Code', default='./output')
    
    args = parser.parse_args()
    
    # Create output directory if it doesn't exist
    os.makedirs(args.output_dir, exist_ok=True)
    
    try:
        logger.info(f"Testing VS Code packager with backup: {args.backup_path}")
        
        # Create the packager
        packager = VSCodePackager()
        
        # Create the package
        package_path = packager.create_vscode_package(args.backup_path)
        
        # Copy the package to the output directory
        output_path = os.path.join(args.output_dir, os.path.basename(package_path))
        
        logger.info(f"Package created at: {package_path}")
        logger.info(f"Copying to output directory: {output_path}")
        
        # Copy the package
        import shutil
        shutil.copy2(package_path, output_path)
        
        logger.info(f"Test completed successfully. Package available at: {output_path}")
        return 0
        
    except Exception as e:
        logger.exception(f"Error testing VS Code packager: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 