# Eno Frontend Documentation Index

## Core Documentation
- **[Development Guide](../CLAUDE.md)** - Primary development guide and setup instructions
- **[README](../README.md)** - Project overview and quick start
- **[Archive](../ARCHIVE.md)** - Information about archived files and historical context

## Deployment Documentation
- **[Production Server Guide](productionserver.md)** - Complete production deployment procedures
- **[Deploy Instructions](DEPLOY_INSTRUCTIONS.md)** - General deployment steps
- **[Test Server Guide](testserver.md)** - Local development setup

## Project Documentation
- **[Project Overview October 2025](PROJECT_OVERVIEW_2025_10_01.md)** - Current state and architecture overview

## Archived Feature Documentation
- **[Archive Folder](../archive/documentation/)** - Historical implementation docs:
  - Bug fixes and debug information
  - Map viewer implementation details
  - Wiki UI redesign documentation
  - Audio integration documentation

## Code Structure
```
Eno-Frontend/
├── js/                    # JavaScript source code
│   ├── routes/           # API route handlers
│   ├── services/         # Service modules (image, audio)
│   ├── utils/            # Utility functions
│   ├── components/       # UI components
│   └── tests/            # Test files
├── hml/                  # HTML templates
├── css/                  # Stylesheets
├── portraits/            # Character portraits
├── static/               # Static assets
├── docs/                 # Documentation (this folder)
├── archive/              # Archived files and old implementations
└── data/                 # Runtime data (SQLite database)
```

## Key Features
- **Auto-Media Generation**: AI-powered image and audio generation from post content
- **Game Structure**: Games → Chapters → Beats → Posts
- **User Roles**: Admin, Game Master, Player
- **Wiki System**: Dynamic wiki with map integration
- **Map System**: Multi-level geospatial visualization

## Development Workflow
1. **Local Development**: `node js/server_sqlite_new.js`
2. **Database**: Auto-created SQLite in `data/database.sqlite`
3. **Testing**: Access at http://localhost:3000
4. **Deployment**: Use `deploy_complete_features.sh`

## Environment Setup
Copy `.env.example` to `.env` and configure:
- Stability AI API key
- AWS credentials for S3
- Anthropic API key
- JWT secret

## Quick Links
- **Production**: https://www.iinou.eu
- **Development**: http://localhost:3000 (when running locally)
- **GitHub**: Repository root directory