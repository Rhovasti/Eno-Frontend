# Eno Game Platform Frontend

This is the frontend for the Eno game platform, a web-based application for text-based role-playing games.

## Setup and Installation

1. Install dependencies:
   ```
   npm install
   ```

2. Set up the database:
   ```
   mysql -u your_username -p < mysql_schema.sql
   ```

3. Start the server:
   ```
   node js/server.js
   ```

## Features

- User authentication (login/register)
- Game creation and management
- Chapter and beat structure for organizing game content
- Post creation within beats
- Role-based permissions (admins, game masters, players)

## API Endpoints

### Authentication
- `POST /api/login`: Log in with email and password
- `POST /api/register`: Register a new user account
- `POST /api/logout`: Log out the current user
- `GET /api/user`: Get current user information

### Games
- `GET /api/games`: Get all games
- `POST /api/games`: Create a new game

### Chapters
- `GET /api/games/:gameId/chapters`: Get chapters for a game
- `POST /api/games/:gameId/chapters`: Create a chapter in a game

### Beats
- `GET /api/chapters/:chapterId/beats`: Get beats for a chapter
- `POST /api/chapters/:chapterId/beats`: Create a beat in a chapter
- `GET /api/beats/:beatId/posts`: Get posts for a beat

### Posts
- `GET /api/posts`: Get all posts (admin only)
- `POST /api/posts`: Create a new post in a beat

## Utilities

### Fetch Beat Posts Script

The repository includes a Python script `fetch_beat_posts.py` to fetch posts for a specific beat. This is useful for extracting game content for archiving or analysis.

Usage:
```
python fetch_beat_posts.py BEAT_ID [options]
```

Options:
- `--url URL`: Base URL of the Eno API (default: http://localhost:3000/)
- `--email EMAIL`: Email for authentication
- `--password PASSWORD`: Password for authentication
- `--save FILENAME`: Save output to file
- `--format {text,json}`: Output format (default: text)

Example:
```
python fetch_beat_posts.py 5 --url https://yourgameserver.com/ --email user@example.com --password secret --save game_posts --format json
```

### Post to Beat Script

The repository also includes a Python script `post_to_beat.py` to create new posts in a beat as either a GM or player.

Usage:
```
python post_to_beat.py BEAT_ID [options]
```

Options:
- `--url URL`: Base URL of the Eno API (default: http://localhost:3000/)
- `--email EMAIL`: Email for authentication (required)
- `--password PASSWORD`: Password for authentication (required)
- `--title TITLE`: Title of the post (required) 
- `--content TEXT`: Content of the post
- `--file FILENAME`: Read content from file instead of command line
- `--type {gm,player}`: Post type (default: player)
- `--debug`: Enable debug output

Example:
```
python post_to_beat.py 5 --url https://yourgameserver.com/ --email gm@example.com --password secret --title "GM Update" --file gm_story.txt --type gm
```

## Database Schema

The application uses a MySQL database with the following tables:
- `users`: User accounts and authentication
- `games`: Game instances
- `chapters`: Sections within games
- `beats`: Story points within chapters
- `posts`: User posts within beats

## Contributing

Please follow the code style guidelines in the CLAUDE.md file when contributing to this project.