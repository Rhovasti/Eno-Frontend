# Eno Frontend Project Status

## What Works

1. **Server Setup**:
   - Both MySQL and SQLite server implementations work
   - Basic API endpoints for user authentication (register, login, logout)
   - Role-based authorization system (admin, gm, player roles)

2. **User Management**:
   - User registration and authentication
   - Admin panel for role management
   - JWT-based authentication with token storage

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
   - Local MySQL setup needs debugging (auth issues)
   - SQLite works as dev alternative but needs better integration

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
   - Fix MySQL connection issues or standardize on SQLite

2. **Medium Priority**:
   - Add chapter/beat archiving functionality
   - Implement post editing functionality 
   - Enhance the storyboard visualization
   - Add image upload capability
   - Implement better error handling

3. **Low Priority**:
   - Create proper documentation
   - Implement user preferences
   - Add notification system

## Development Setup

1. **SQLite Setup** (Easiest for development):
   ```
   npm install
   node js/server_sqlite.js
   ```

2. **MySQL Setup** (Production preferred):
   ```
   # Fix database connection first
   node js/server.js
   ```

3. **Test Account**:
   - Admin: admin@example.com / admin123
   - Test User: test@example.com / testpassword123