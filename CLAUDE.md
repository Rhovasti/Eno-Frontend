# Eno Frontend Development Guide

## Important Documentation
- **Test Server Guide**: See `testserver.md` for local development setup
- **Production Server Guide**: See `productionserver.md` for deployment procedures
- **Known Issues**: See `KNOWN_ISSUES.md` for current bugs and workarounds
- **Project Status**: See `PROJECT_STATUS.md` for feature status and roadmap
- **Planned Features**: See `PLANNED_FEATURES.md` for upcoming feature specifications and roadmap
- **SSL Renewal Issue**: See `SSL_RENEWAL_ISSUE.md` for current SSL certificate problem and solutions

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
- **AI Image Generation**: Sketch + style transfer using Stability AI
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
- **Quick Deploy**: Run `./deploy_image_generation.sh`
- **Manual Deploy**: See steps in `productionserver.md`
- **Server Restart**: `pkill -f "node.*server" && node js/server_sqlite_new.js &`