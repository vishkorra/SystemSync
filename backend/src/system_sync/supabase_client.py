from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Supabase credentials not found in environment variables")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Database table names
BACKUPS_TABLE = 'backups'
USER_SETTINGS_TABLE = 'user_settings'
BACKUP_FILES_TABLE = 'backup_files' 