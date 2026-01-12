# Avatar URL Fix - Database Migration

## Problem
Avatar URLs were stored as absolute URLs (`http://localhost:3001/uploads/...`) in the database, causing issues in production.

## Solution
1. Backend now returns relative paths (`/uploads/...`)
2. Frontend uses `getFileUrl()` helper to construct full URLs
3. Database needs to be updated to use relative paths

## Database Migration

### On Production Server (Contabo)

```bash
# Connect to MySQL
mysql -u root -p learning
```

```sql
-- Check current avatar URLs
SELECT id, name, avatar_url FROM users WHERE avatar_url IS NOT NULL;

-- Update all localhost URLs to relative paths
UPDATE users 
SET avatar_url = REPLACE(avatar_url, 'http://localhost:3001', '') 
WHERE avatar_url LIKE 'http://localhost:3001%';

-- Update production URLs to relative paths (if any exist)
UPDATE users 
SET avatar_url = REPLACE(avatar_url, 'https://chefteme.ro/api', '') 
WHERE avatar_url LIKE 'https://chefteme.ro/api%';

-- Verify the update
SELECT id, name, avatar_url FROM users WHERE avatar_url IS NOT NULL;
```

Expected result: All `avatar_url` values should start with `/uploads/` (relative paths)

Example:
- Before: `http://localhost:3001/uploads/1768245555294-804510919-me and VP.png`
- After: `/uploads/1768245555294-804510919-me and VP.png`

## Files Changed

### Backend
- `server/index.js`
  - `/upload-image` endpoint now returns relative path
  - Email template uses `FRONTEND_URL` variable

### Frontend
- `client/config.ts` - Added `getFileUrl()` helper
- `client/components/Navbar.tsx` - Uses `getFileUrl()` for avatars
- `client/components/LeaderboardItem.tsx` - Uses `getFileUrl()` for avatars
- `client/components/ChatWindow.tsx` - Uses `getFileUrl()` for avatars
- `client/components/CreateChatModal.tsx` - Uses `getFileUrl()` for avatars

## Testing
1. Upload new avatar - should save as `/uploads/...`
2. Display avatar - should show correctly with full URL
3. Chat images - should work with full URL construction
4. Leaderboard avatars - should display correctly
