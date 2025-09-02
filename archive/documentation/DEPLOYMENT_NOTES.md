# Production Deployment Notes - AI GM Feature Fix

## Date: May 25, 2025

## Changes Made:

### 1. Fixed AI GM Post Creation
- **Issue**: AI GM posts were not being saved because they were using author_id: 1 (a regular player)
- **Fix**: Created dedicated AI_GM_System user (ID: 5) and updated all AI post creation to use this ID
- **Files Modified**: 
  - `js/server_sqlite_ai_gm_enhanced.js` (lines 1602, 1615, 1930)

### 2. Fixed GM Role Permission Check
- **Issue**: GM users couldn't access AI endpoints due to incorrect role parsing
- **Fix**: Updated JWT token creation to properly parse roles from JSON array
- **Files Modified**: 
  - `js/server_sqlite_ai_gm_enhanced.js` (lines 870-895)

### 3. Fixed Game Creation Column Mismatch
- **Issue**: Game creation failed due to using 'title' instead of 'name' column
- **Fix**: Updated INSERT statement to use correct column names
- **Files Modified**: 
  - `js/server_sqlite_ai_gm_enhanced.js` (lines 1091-1095)

## Database Changes Required:

1. Create AI_GM_System user (run `create_ai_gm_user.js`)
2. No schema changes required

## Test Accounts Created:
- Admin: admin@example.com / admin123
- Human GM: gm@example.com / gm123

## Server to Deploy:
- Use `js/server_sqlite_ai_gm_enhanced.js` as the main server file

## Important Notes:
- The AI_GM_System user must have ID: 5 (or update the code if different)
- Ensure AI_API_KEY environment variable is set on production
- The server has some SQL trigger errors on startup but they don't affect functionality