@echo off
REM Deployment preparation script for Windows
REM Run this on your LOCAL Windows machine to build the project

echo ðŸš€ Starting deployment preparation...

REM 1. Build client
echo ðŸ“¦ Building client...
cd client
call npm run build
if errorlevel 1 (
  echo âŒ Client build failed!
  exit /b 1
)
cd ..

echo âœ… Client built successfully!

REM 2. Create deployment package
echo ðŸ“¦ Creating deployment package...
if not exist deploy mkdir deploy
xcopy /E /I /Y server deploy\server
xcopy /E /I /Y client\dist deploy\client
copy server\.env.example deploy\server\.env.example
copy client\.env.example deploy\client\.env.example

echo âœ… Deployment package ready in .\deploy directory
echo.
echo ðŸ“‹ Next steps:
echo 1. Upload .\deploy folder to your Contabo server (use FileZilla, WinSCP, or scp)
echo 2. SSH into your server
echo 3. Install Node.js (v18+) and MySQL if not already installed
echo 4. Copy server/.env.example to server/.env and configure
echo 5. Run: cd server ^&^& npm install --production
echo 6. Run: npm run setup:db  # Setup database
echo 7. Run: npm start  # Start server with PM2
echo 8. Configure nginx to serve client folder and proxy API to Node.js

pause
