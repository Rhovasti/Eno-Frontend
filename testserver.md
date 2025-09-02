# Eno Frontend Test Server Documentation

## Quick Start

### Starting the Server
```bash
# From /root/Eno/Eno-Frontend directory
export AWS_REGION=eu-north-1 && export AWS_BUCKET_NAME=kuvatjakalat && node js/server_sqlite_new.js &
```

**Server URL:** `http://localhost:3000`

### Environment Variables Required
```bash
# These are in .env file (automatically loaded)
STABILITY_API_KEY=your_stability_api_key_here
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key_here
AWS_BUCKET_NAME=kuvatjakalat
AWS_REGION=eu-north-1
AI_API_KEY=
```

## Database

### Database File
- **SQLite Database:** `/root/Eno/Eno-Frontend/data/database.sqlite`
- **Schema:** Uses dotenv config and auto-creates tables on startup

### Key Tables
```sql
-- Users (with authentication)
users (id, username, email, password, roles, is_admin, bio, created_at, updated_at)

-- Game hierarchy
games (id, name, description, created_at, updated_at)
chapters (id, game_id, sequence_number, title, description, is_archived, archived_at, archived_narrative, created_at, updated_at)
beats (id, chapter_id, sequence_number, title, content, created_at, updated_at)
posts (id, beat_id, author_id, title, content, post_type, dice_roll, created_at, updated_at)

-- AI Image Generation
post_images (id, post_id, user_id, prompt, negative_prompt, image_url, thumbnail_url, generation_params, created_at)
```

## API Endpoints

### Authentication
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/register` | User registration | No |
| POST | `/api/login` | User login | No |
| POST | `/api/logout` | User logout | Yes |

### Games & Structure
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/games` | List all games | Yes |
| POST | `/api/games` | Create new game | Yes (GM/Admin) |
| GET | `/api/games/:gameId/chapters?includeArchived=true` | Get chapters for game | Yes |
| POST | `/api/games/:gameId/chapters` | Create new chapter | Yes (GM/Admin) |
| GET | `/api/chapters/:chapterId/beats` | Get beats with ALL posts | Yes |
| POST | `/api/chapters/:chapterId/beats` | Create new beat | Yes (GM/Admin) |
| POST | `/api/chapters/:chapterId/archive` | Archive chapter | Yes (GM/Admin) |

### Posts & Content
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/posts` | Create new post | Yes |
| GET | `/api/posts/:postId/images` | Get images for post | Yes |

### AI Image Generation
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/posts/:postId/generate-image` | Generate AI image | Yes |

**Image Generation Request Body:**
```json
{
  "prompt": "text description",
  "style": "cartoon", // optional: "cartoon", "fantasy-art", "digital-art", "anime"
  "sketch": "base64_image_data" // optional: doodle canvas data
}
```

### User Management (Admin Only)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/users` | List all users | Yes (Admin) |
| PUT | `/api/users/:userId/roles` | Update user roles | Yes (Admin) |

## Frontend Pages

### Main Pages
- **Login:** `http://localhost:3000/hml/login.html`
- **Register:** `http://localhost:3000/hml/register.html`
- **Threads:** `http://localhost:3000/hml/threads.html` (main game interface)
- **Admin:** `http://localhost:3000/hml/admin.html`
- **Profile:** `http://localhost:3000/hml/profile.html`

### Test Pages
- **Doodle Image Test:** `http://localhost:3000/hml/test_doodle_image.html`

## Key Features

### 1. Sketch + Style Transfer Image Generation
- **Doodle Canvas:** 512x512 drawing area with brush tools
- **Style Transfer:** Uses random images from `/style` folder when "cartoon" style selected
- **AI Backend:** Stability AI SD 3.5 Medium with ControlNet
- **Storage:** AWS S3 bucket "kuvatjakalat"

### 2. Game Structure
```
Game → Chapters → Beats → Posts
```

### 3. User Roles
- **Admin:** Full access to everything
- **GM (Game Master):** Can create chapters, beats, archive content
- **Player:** Can create posts, generate images

### 4. Post Types
- **GM Posts:** Special styling, can archive chapters
- **Player Posts:** Regular posts with indentation

## Common Issues & Solutions

### 1. Server Won't Start
```bash
# Kill any existing server
pkill -f "node.*server"

# Start with proper environment variables
export AWS_REGION=eu-north-1 && export AWS_BUCKET_NAME=kuvatjakalat && node js/server_sqlite_new.js &
```

### 2. Posts Not Appearing
- **Issue:** Beats endpoint was showing only first post per beat
- **Solution:** Modified to return ALL posts in `posts` array
- **File:** `js/server_sqlite_new.js` line 581 uses `db.all` not `db.get`

### 3. Image Generation Errors
**Common Causes:**
- Missing AWS environment variables
- Wrong database table schema (use `generation_params` not `metadata`)
- Post not found (ensure post ID exists)

### 4. Database Schema Mismatch
**post_images table columns:**
```sql
(post_id, user_id, image_url, thumbnail_url, prompt, generation_params)
-- NOT: (post_id, game_id, user_id, ..., metadata)
```

## File Structure

### Key Files
```
/root/Eno/Eno-Frontend/
├── .env                           # Environment variables
├── js/server_sqlite_new.js        # Main server file
├── js/services/imageService.js    # AI image generation
├── js/threads.js                  # Frontend game interface
├── hml/threads.html              # Main game UI
├── css/styles.css                # Styles including doodle canvas
├── data/database.sqlite          # SQLite database
├── style/                        # Style reference images (20 PNG files)
└── portraits/                    # Character portraits
```

### Server Files
- **Current:** `js/server_sqlite_new.js` (recommended)
- **Alternative:** `js/server_sqlite.js` (older version)
- **MySQL:** `js/server.js` (has connection issues)

## Testing Checklist

### Before Each Session
1. ✅ Server starts without errors
2. ✅ Can login at `/hml/login.html`
3. ✅ Can access threads at `/hml/threads.html`
4. ✅ Can create posts
5. ✅ Posts appear immediately after creation
6. ✅ Can generate images with text prompts
7. ✅ Can generate images with doodle + style transfer

### Image Generation Test
1. Create a post in any beat
2. Enter text prompt: "a dragon in a castle"
3. Draw simple sketch in doodle canvas
4. Select "Cartoon" style
5. Click "Generate Image"
6. Should see: Real AI-generated image uploaded to S3

## Architecture Notes

### Authentication
- JWT tokens stored in cookies
- Middleware: `authenticateToken` on protected routes
- Roles stored as JSON array in user record

### Image Generation Flow
1. User draws sketch → base64 data
2. Frontend sends: prompt + sketch + style
3. Server converts sketch to buffer
4. If "cartoon" style: randomly selects from `/style` folder
5. Uses ControlNet for sketch-guided generation
6. Uploads to S3, saves metadata to database
7. Returns image URLs to frontend

### Database Relations
```sql
posts.beat_id → beats.id
beats.chapter_id → chapters.id  
chapters.game_id → games.id
posts.author_id → users.id
post_images.post_id → posts.id
```

This server setup provides a complete RPG gaming platform with AI-assisted content creation!