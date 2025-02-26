import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables from .env file if present
load_dotenv()

if __name__ == "__main__":
    # Get configuration from environment variables or use defaults
    port = int(os.environ.get("PORT", 8001))
    host = os.environ.get("HOST", "0.0.0.0")
    log_level = os.environ.get("LOG_LEVEL", "info").lower()
    
    print(f"Starting server on {host}:{port} with log level {log_level}")
    
    # Start the server
    uvicorn.run(
        "api:app",
        host=host,
        port=port,
        log_level=log_level,
        reload=os.environ.get("ENVIRONMENT", "production").lower() == "development"
    ) 