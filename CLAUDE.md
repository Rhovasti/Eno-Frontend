# Eno Frontend Development Guide

## Build Commands
- **Start Server**: `node js/server.js`
- **Database Setup**: Import schema from `sql/mysql_schema.txt`
- **Frontend**: Open HTML files directly in browser or use a static server

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