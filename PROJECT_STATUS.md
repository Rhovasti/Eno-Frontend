# Eno Frontend Project Status

## Recent Updates (Feb 2025)

1. **Fixed User Registration & Admin Panel Issues**:
   - Fixed CommonJS/ES module compatibility issue in package.json
   - Improved token handling in admin.html for better authentication
   - Enhanced error handling and debugging in the SQLite server
   - Registration system now working properly

2. **Python Script Improvements**:
   - Enhanced compatibility of fetch_beat_posts.py and post_to_beat.py scripts
   - Added better error handling and role parsing
   - Improved token management for API authentication
   - Scripts now work reliably with both MySQL and SQLite backends

3. **Database Standardization**:
   - Moved to SQLite as primary database for simpler deployment
   - Created systemd service for reliable server operation
   - Resolved schema parsing issues

## What Works

1. **Server Setup**:
   - Both MySQL and SQLite server implementations work
   - Basic API endpoints for user authentication (register, login, logout)
   - Role-based authorization system (admin, gm, player roles)

2. **User Management**:
   - ✅ User registration and authentication functioning properly
   - ✅ Admin panel for role management working correctly
   - ✅ JWT-based authentication with token storage
   - ✅ Python scripts for automated post management

3. **Game Structure**:
   - Basic hierarchy of Games → Chapters → Beats → Posts established
   - API endpoints for most CRUD operations on these entities
   - Role-based permissions (GMs can create content, players can post)

4. **Frontend UI**:
   - Basic HTML/CSS interface
   - Login/registration pages
   - Admin interface for user management

## What Needs Work

1. **Database Setup**:
   - ✅ SQLite now working properly as primary database
   - MySQL setup remains as an option but needs further debugging

2. **UI Improvements**:
   - Thread display page needs completion
   - Storyboard and Wiki pages are placeholders
   - Mobile responsiveness could be improved

3. **Security Enhancements**:
   - Move JWT secret to environment variables
   - ✅ HTTPS implemented on production (https://www.iinou.eu)
   - Add rate limiting for login attempts

4. **Game Structure Issues**:
   - Fix post creation flow (currently creates new beats incorrectly)
   - Implement correct workflow: GMs create chapters & beats, both GMs & players add posts to existing beats
   - Add functionality to close/archive chapters and beats to maintain story flow
   - Ensure current chapter/beat is clearly indicated to players

5. **Feature Gaps**:
   - Post editing functionality missing
   - No image upload capabilities
   - No notification system
   - Better error handling and user feedback

6. **Testing**:
   - No automated tests
   - Manual testing scripts are basic

## Next Steps

1. **High Priority**:
   - Fix the post creation flow (should add posts to existing beats, not create new beats)
   - Implement GM-only creation of chapters and beats
   - Complete the threads.html page implementation

2. **Medium Priority**:
   - Add chapter/beat archiving functionality
   - Implement post editing functionality 
   - Enhance the storyboard visualization
   - Implement better error handling

3. **Low Priority**:
   - Create proper documentation
   - Implement user preferences
   - Add notification system

## Future Features

1. **Image Support**:
   - Add image upload capability for posts
   - Integrate with S3 bucket (https://kuvatjakalat.s3.eu-north-1.amazonaws.com/)
   - Add image moderation and size limits

2. **Dice Rolling System**:
   - Implement random dice rolls for game checks
   - Support various dice systems (d20, d100, etc.)
   - Allow GM to set difficulty thresholds
   - Display roll results in posts

## Development Setup

1. **SQLite Setup** (Recommended):
   ```
   npm install
   node js/server_sqlite_new.js
   ```

2. **MySQL Setup** (Alternative):
   ```
   # Fix database connection first
   node js/server.js
   ```

3. **Test Account**:
   - Admin: admin@example.com / admin123
   - Test User: test@example.com / testpassword123

4. **Python Scripts**:
   ```
   # Fetch posts from a beat
   ./fetch_beat_posts.py BEAT_ID --url https://www.iinou.eu/ --email admin@example.com --password admin123
   
   # Post to a beat
   ./post_to_beat.py BEAT_ID --url https://www.iinou.eu/ --email admin@example.com --password admin123 --title "Test Post" --content "This is a test post" --type gm
   ```