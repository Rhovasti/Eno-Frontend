# Eno Frontend Project Status

## Recent Updates (May 2025)

1. **Dice Rolling System** (May 25, 2025):
   - Full dice notation support (2d6+3, 1d20, etc.) for GMs and players
   - Dice rolls integrated into post creation with visual display
   - Results stored in database with full history tracking
   - Deployed to production at www.iinou.eu
   - Added dice roll display in posts with clear visual formatting

2. **AI Image Generation** (May 25, 2025):
   - Integrated Stability AI for scene generation
   - AWS S3 bucket integration for image storage
   - Automatic Finnish-to-English translation for prompts
   - Thumbnail generation for performance
   - Post-creation workflow for adding images
   - Ready for production deployment (currently localhost only)

3. **AI-Powered Game Creation Features**:
   - Integrated Anthropic Claude API for AI content generation
   - GMs can generate game descriptions based on genre, theme, and keywords
   - AI-assisted first chapter creation with contextual content
   - Complete story arc generation (3-10 chapters) with narrative progression
   - AI usage tracking and rate limiting (100 requests/day per user)

2. **GM Dashboard Implementation**:
   - Comprehensive game management interface at `/hml/gm-dashboard.html`
   - Editable story outline/arc with chapter status tracking
   - Game progress monitoring (player count, posts, activity)
   - Game settings management (title, description, player limits, status)
   - Integration with AI story arc generation
   - Database schema extended with `game_outlines` table

3. **User Profile System**:
   - Added bio field to user profiles
   - Profile page with editable user information
   - Display of user roles and badges (Admin, GM, Player)
   - Profile links in navigation for authenticated users

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
   - ✅ AI integration with Anthropic Claude API
   - ✅ Extended API endpoints for outlines, game settings, and progress tracking

2. **User Management**:
   - ✅ User registration and authentication functioning properly
   - ✅ Admin panel for role management working correctly
   - ✅ JWT-based authentication with token storage
   - ✅ Python scripts for automated post management
   - ✅ User profiles with bio and role display

3. **Game Structure**:
   - Basic hierarchy of Games → Chapters → Beats → Posts established
   - API endpoints for most CRUD operations on these entities
   - Role-based permissions (GMs can create content, players can post)
   - ✅ Chapter archiving system implemented - GMs can archive chapters, compiling beats into narratives
   - ✅ Archived chapters displayed chronologically on storyboard page
   - ✅ Game outlines/story arcs with editable chapter planning
   - ✅ AI-powered chapter and story arc generation

4. **Frontend UI**:
   - Basic HTML/CSS interface
   - Login/registration pages
   - Admin interface for user management
   - ✅ GM Dashboard for comprehensive game management
   - ✅ Enhanced game creation with AI assistance
   - ✅ User profile pages
   - ✅ Dice rolling system integrated into posts
   - ✅ AI image generation for post scenes (localhost only)

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
   - GM Dashboard access needs better navigation (game ID discovery issue)
   - Need visual indicators showing which games user is GM of

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
   - ✅ GM Dashboard and AI features implemented
   - Improve GM Dashboard navigation (add links from game lists, show GM badge on games)
   - Ensure current chapter/beat is clearly indicated to players (NOT IMPLEMENTED - no UI indication)

2. **Medium Priority**:
   - Implement post editing functionality 
   - Implement better error handling
   - Move JWT secret to environment variables
   - ✅ Dice rolling system implemented (May 25, 2025)
   - Add "My Games" page for GMs to see all their games
   - Improve mobile SSL certificate handling

3. **Low Priority**:
   - Create proper documentation
   - Implement user preferences
   - Add notification system
   - Add game templates library

## Future Features

1. **Image Support** (Partially Complete):
   - ✅ AI image generation integrated with Stability AI
   - ✅ S3 bucket integration working (kuvatjakalat bucket)
   - ✅ Automatic image optimization and thumbnails
   - TODO: Character consistency system
   - TODO: Image upload capability for custom images
   - TODO: Image moderation and content filtering

2. **Dice Rolling System** (✅ Completed May 25, 2025):
   - ✅ Random dice rolls for game checks
   - ✅ Support for various dice notations (2d6+3, 1d20, etc.)
   - ✅ Display roll results inline with posts
   - ✅ Dice roll history tracking

## Non-Critical Improvements

1. **UI/UX Refinements**:
   - Rename "Langat" (Threads) to "Pelit" (Games) in threads.html page navigation
   - Add game selection to storyboard page - display games as links, show story content when clicked
   - Add English translation for the entire site (internationalization support)
   - Make username in "Tervetuloa <name>" a clickable link to user's profile page
   - Add owned games list to GM profiles (similar to posts list)

2. **Navigation Enhancements**:
   - Improve storyboard navigation with game filtering
   - Add breadcrumb navigation for better user orientation
   - Visual indicators for current chapter/beat in game view
   - Profile links should show user's games if they are a GM

3. **Profile Page Enhancements**:
   - Display list of games owned by GM users
   - Show game statistics (player count, post count) for each owned game
   - Add quick links to GM Dashboard for each owned game
   - Better visual hierarchy for profile information

## Development Setup

1. **SQLite Setup** (Recommended):
   ```
   npm install
   node js/server_sqlite_gm_dashboard.js  # Latest version with all features
   ```

2. **MySQL Setup** (Alternative):
   ```
   # Fix database connection first
   node js/server.js
   ```

3. **Environment Variables**:
   ```
   # Create .env file
   AI_API_KEY=your-anthropic-api-key
   JWT_SECRET=your-secret-key
   AI_MODEL=claude-3-haiku-20240307
   AI_MAX_TOKENS_PER_REQUEST=1000
   AI_MAX_REQUESTS_PER_DAY=100
   ```

4. **Test Account**:
   - Admin: admin@example.com / admin123
   - Test User: test@example.com / testpassword123

5. **Python Scripts**:
   ```
   # Fetch posts from a beat
   ./fetch_beat_posts.py BEAT_ID --url https://www.iinou.eu/ --email admin@example.com --password admin123
   
   # Post to a beat
   ./post_to_beat.py BEAT_ID --url https://www.iinou.eu/ --email admin@example.com --password admin123 --title "Test Post" --content "This is a test post" --type gm
   ```

## Key Features Summary

- **AI-Powered Content**: Generate game descriptions, chapters, and complete story arcs
- **GM Dashboard**: Comprehensive game management with outline tracking
- **User Profiles**: Enhanced user system with roles and bios
- **Chapter Archiving**: Compile beats into narrative chapters
- **Mobile Support**: Basic mobile responsiveness (SSL issues on some devices)