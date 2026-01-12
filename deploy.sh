#!/bin/bash

# Deployment script for Contabo server
# Run this on your LOCAL machine to build, then upload to server

echo "ðŸš€ Starting deployment preparation..."

# 1. Build client
echo "ðŸ“¦ Building client..."
cd client
npm run build
if [ $? -ne 0 ]; then
  echo "âŒ Client build failed!"
  exit 1
fi
cd ..

echo "âœ… Client built successfully!"

# 2. Create deployment package
echo "ðŸ“¦ Creating deployment package..."
mkdir -p deploy
cp -r server deploy/
cp -r client/dist deploy/client
cp .env.example deploy/server/.env.example
cp .env.example deploy/client/.env.example

echo "âœ… Deployment package ready in ./deploy directory"
echo ""
echo "ðŸ“‹ Next steps:"
echo "1. Upload ./deploy folder to your Contabo server"
echo "2. SSH into your server"
echo "3. Install Node.js (v18+) and MySQL if not already installed"
echo "4. Copy server/.env.example to server/.env and configure"
echo "5. Run: cd server && npm install --production"
echo "6. Run: npm run setup:db  # Setup database"
echo "7. Run: npm start  # Start server"
echo "8. Configure nginx/apache to serve client folder and proxy /api to Node.js"
