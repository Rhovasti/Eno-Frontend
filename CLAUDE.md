# Eno Frontend Development Guide

## Important Documentation
- **Production Server Guide**: See `productionserver.md` for deployment procedures
- **Archive Documentation**: See `ARCHIVE.md` for information about archived files
- **Feature Documentation**: See `WIKI_UI_*`, `MAP_*`, and other feature-specific .md files
- **Auto-Media Generation**: See `docs/AUTO_MEDIA_GENERATION.md` for user guide and `docs/AUTO_MEDIA_GENERATION_TECHNICAL.md` for technical docs
- **Test Server Guide**: See `testserver.md` for local development setup

## Build Commands
- **Start Server**: `node js/server_sqlite_new.js` (SQLite version recommended)
- **Database Setup**: SQLite auto-creates tables on startup
- **Frontend**: Served via Node.js on port 3000

## Code Style Guidelines

### JavaScript
- Use camelCase for variables and functions
- 4-space indentation
- Event-driven architecture with DOM event listeners
- Error handling: Promise catch blocks with console.error
- Express middleware pattern for server routes
- RESTful API with JSON for data exchange

### HTML/CSS
- Semantic HTML structure
- Class-based styling
- Responsive design principles

### Database
- Follow schema in `sql/mysql_schema.txt`
- Data hierarchy: games → chapters → beats → posts
- Properly parameterized SQL queries to prevent injection

### Naming Conventions
- Files: lowercase with descriptive names
- Variables: camelCase that clearly indicate purpose
- Database: snake_case for column names

### Error Handling
- Consistent error objects with status codes
- User-friendly error messages
- Proper logging of errors to console

## Current Architecture

### Server Setup
- **Development**: `node js/server_sqlite_new.js` on http://localhost:3000
- **Production**: https://www.iinou.eu (see `productionserver.md`)
- **Database**: SQLite (`data/database.sqlite`)
- **Image Storage**: AWS S3 bucket "kuvatjakalat"

### Key Features
- **Auto-Media Generation**: AI-powered automatic image and audio generation from post content (see `docs/AUTO_MEDIA_GENERATION.md`)
- **AI Image Generation**: Stability AI SD 3.5 Medium with ControlNet support for character portraits
- **Game Structure**: Games → Chapters → Beats → Posts
- **User Roles**: Admin, GM (Game Master), Player
- **Authentication**: JWT tokens in cookies

### Environment Variables
Required in `.env` file:
```
STABILITY_API_KEY=your_stability_api_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_BUCKET_NAME=kuvatjakalat
AWS_REGION=eu-north-1
AI_API_KEY=your_anthropic_api_key
JWT_SECRET=change_in_production
```

### Deployment
- **Full Deploy**: `./deploy_complete_features.sh` (recommended for production)
- **Image Deploy**: `./deploy_image_generation.sh` (specialized for image features)
- **Wiki Deploy**: `./DEPLOYMENT_WIKI_UI.sh` (wiki-specific updates)
- **Quick Restart**: `./production_restart.sh` or `./restart_iinou_server.sh`
- **Manual Deploy**: See detailed steps in `productionserver.md`
- **Archived Scripts**: See `ARCHIVE.md` for historical deployment methods