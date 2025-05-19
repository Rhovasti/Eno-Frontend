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
   - ✅ Chapter archiving system implemented - GMs can archive chapters, compiling beats into narratives
   - ✅ Archived chapters displayed chronologically on storyboard page

4. **Frontend UI**:
   - Basic HTML/CSS interface
   - Login/registration pages
   - Admin interface for user management

## What Needs Work

1. **Database Setup**:
   - ✅ SQLite now working properly as primary database
   - MySQL setup remains as an option but needs further debugging

2. **UI Improvements**:
   - ✅ Thread display page completed (see high priority items)
   - ✅ Storyboard page now fully functional - displays archived chapters with compiled narratives
   - Wiki page remains a placeholder (only static content)
   - Mobile responsiveness could be improved
   - Navigation terminology could be improved ("Langat" → "Pelit")
   - Storyboard page could use game-based filtering/navigation
   - English language support needed for internationalization

3. **Security Enhancements**:
   - Move JWT secret to environment variables
   - ✅ HTTPS implemented on production (https://www.iinou.eu)
   - Add rate limiting for login attempts

4. **Game Structure Issues**:
   - ✅ Post creation fixed - posts now correctly add to existing beats (fixed in commit f70a3d5)
   - ✅ Correct workflow implemented: GMs create chapters & beats, both GMs & players add posts to existing beats
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
   - ✅ Chapter archiving functionality implemented (GMs can archive chapters, beats compiled into narrative)
   - Ensure current chapter/beat is clearly indicated to players (NOT IMPLEMENTED - no UI indication)

2. **Medium Priority**:
   - Implement post editing functionality 
   - Implement better error handling
   - Move JWT secret to environment variables
   - Add dice rolling system for game checks

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

## Non-Critical Improvements

1. **UI/UX Refinements**:
   - Rename "Langat" (Threads) to "Pelit" (Games) in threads.html page navigation
   - Add game selection to storyboard page - display games as links, show story content when clicked
   - Add English translation for the entire site (internationalization support)

2. **Navigation Enhancements**:
   - Improve storyboard navigation with game filtering
   - Add breadcrumb navigation for better user orientation
   - Visual indicators for current chapter/beat in game view

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