# VS Code Backup & Sync Tool

A web application for backing up and synchronizing VS Code settings, extensions, and configurations across multiple devices.

## Features

- 🔄 Backup VS Code settings, extensions, and user configurations
- 📊 View and manage your backups through a user-friendly dashboard
- 🚀 Restore backups to a new machine with a single click
- ⏱️ Schedule automatic backups
- 📱 Responsive design for desktop and mobile

## Getting Started

### Option 1: Use the Hosted Version

Access the application directly at: [https://your-deployed-app-url.com](https://your-deployed-app-url.com) (replace with actual URL after deployment)

### Option 2: Run Locally

1. Clone this repository:
   ```
   git clone https://github.com/your-username/vscode-backup-sync.git
   cd vscode-backup-sync
   ```

2. Set up the backend:
   ```
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   cd src
   uvicorn main:app --reload --port 8001
   ```

3. Set up the frontend:
   ```
   cd frontend
   npm install
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Deployment

### Frontend Deployment (Vercel)

1. Fork this repository on GitHub
2. Sign up for a [Vercel](https://vercel.com) account
3. Create a new project in Vercel and import your GitHub repository
4. Select the "Frontend" directory as your root directory
5. Set the following environment variables:
   - `NEXT_PUBLIC_API_URL`: URL of your deployed backend

### Backend Deployment (Render)

1. Sign up for a [Render](https://render.com) account
2. Create a new Web Service
3. Connect to your GitHub repository
4. Set the root directory to "backend"
5. Set the build command: `pip install -r requirements.txt`
6. Set the start command: `cd src && uvicorn main:app --host 0.0.0.0 --port $PORT`
7. Set the following environment variables:
   - `ALLOWED_ORIGINS`: URL of your frontend deployment

## License

MIT
