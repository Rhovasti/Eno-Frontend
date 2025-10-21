# Eno Game Platform Frontend

This is the frontend for the Eno game platform, a comprehensive web-based ecosystem for text-based role-playing games with AI-powered content generation and worldbuilding tools.

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and settings
   ```

3. **Start development server**:
   ```bash
   node js/server_sqlite_new.js
   ```
   The server runs on http://localhost:3000 with auto-created SQLite database.

## Core Features

### Gaming System
- **User Authentication**: Secure login/register with JWT tokens
- **Game Structure**: Games → Chapters → Beats → Posts hierarchy
- **Role Management**: Admin, Game Master, and Player roles
- **Auto-Media Generation**: AI-powered image and audio generation from post content

### AI Integration
- **Image Generation**: Stability AI SD 3.5 Medium with ControlNet support
- **Character Portraits**: Consistent character visualization across sessions
- **Audio Generation**: Stable Audio 2.5 for ambient sound creation
- **Prompt Derivation**: Automatic content analysis for media generation

### Worldbuilding Tools
- **Dynamic Wiki**: Collaborative worldbuilding with rich media support
- **Geospatial Maps**: Multi-level map system (Regional → District → Building → Interior)
- **Economic Simulation**: Integration with Enonomics for realistic world data
- **Knowledge Graph**: N4L domain-specific language for semantic relationships

## Documentation

- **[Development Guide](CLAUDE.md)** - Comprehensive development instructions
- **[Documentation Index](docs/DOCUMENTATION_INDEX.md)** - Complete documentation overview
- **[Production Server Guide](docs/productionserver.md)** - Deployment procedures
- **[Archive](ARCHIVE.md)** - Historical implementation notes

## File Structure

```
Eno-Frontend/
├── js/                    # JavaScript source code
│   ├── routes/           # API route handlers
│   ├── services/         # Service modules (image, audio)
│   ├── utils/            # Utility functions
│   ├── components/       # UI components
│   └── server_sqlite_new.js  # Main server (recommended)
├── hml/                  # HTML templates
├── css/                  # Stylesheets
├── docs/                 # Documentation
├── archive/              # Archived files
└── data/                 # SQLite database (auto-created)
```

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/register` - User registration
- `GET /api/user` - Current user info

### Games & Content
- `GET /api/games` - List all games
- `POST /api/games` - Create new game
- `GET /api/games/:id/chapters` - Game chapters
- `GET /api/chapters/:id/beats` - Chapter beats
- `GET /api/beats/:id/posts` - Beat posts

### Media Generation
- `POST /api/generate/image` - AI image generation
- `POST /api/generate/audio` - AI audio generation

### Maps & Worldbuilding
- `GET /api/maps/*` - Geospatial data APIs
- `GET /api/wiki/*` - Wiki content APIs

## Environment Configuration

Required `.env` variables:
```
STABILITY_API_KEY=your_stability_api_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_BUCKET_NAME=kuvatjakalat
AWS_REGION=eu-north-1
AI_API_KEY=your_anthropic_api_key
JWT_SECRET=change_in_production
```

## Deployment

- **Development**: `node js/server_sqlite_new.js` (port 3000)
- **Production**: `./deploy_complete_features.sh` (full deployment)
- **Live Site**: https://www.iinou.eu

## Database

- **Development**: SQLite (auto-created in `data/database.sqlite`)
- **Production**: MySQL (see production deployment guide)
- **Schema**: Games → Chapters → Beats → Posts hierarchy

## Contributing

Please follow the code style guidelines in the [Development Guide](CLAUDE.md) when contributing to this project.

## License

See LICENSE file for licensing information.