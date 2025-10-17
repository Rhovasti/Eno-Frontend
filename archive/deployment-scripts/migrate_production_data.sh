#!/bin/bash

# Production Data Migration Script
# This script migrates critical data from production backup to fresh localhost database

echo "================================================"
echo "Production Data Migration Script"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BACKUP_SQL="production_backup.sql"
LOCAL_DB="data/database.sqlite"

# Check if backup file exists
if [ ! -f "$BACKUP_SQL" ]; then
    echo -e "${RED}Error: Production backup file $BACKUP_SQL not found!${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Creating backup of current localhost database...${NC}"
cp "$LOCAL_DB" "$LOCAL_DB.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${GREEN}✓ Local database backed up${NC}"

echo -e "${YELLOW}Step 2: Extracting critical production data...${NC}"

# Create temporary SQL files for selective import
echo "-- Users from production" > temp_users.sql
grep "INSERT INTO users" "$BACKUP_SQL" >> temp_users.sql

echo "-- Games from production" > temp_games.sql
grep "INSERT INTO games" "$BACKUP_SQL" >> temp_games.sql

echo "-- Chapters from production" > temp_chapters.sql
grep "INSERT INTO chapters" "$BACKUP_SQL" >> temp_chapters.sql

echo "-- Beats from production" > temp_beats.sql
grep "INSERT INTO beats" "$BACKUP_SQL" >> temp_beats.sql

echo "-- Posts from production" > temp_posts.sql
grep "INSERT INTO posts" "$BACKUP_SQL" >> temp_posts.sql

echo "-- AI GM profiles from production" > temp_ai_profiles.sql
grep "INSERT INTO ai_gm_profiles" "$BACKUP_SQL" >> temp_ai_profiles.sql

echo -e "${GREEN}✓ Production data extracted${NC}"

echo -e "${YELLOW}Step 3: Clearing existing data from localhost database...${NC}"

# Clear existing data but keep schema
sqlite3 "$LOCAL_DB" << 'EOF'
DELETE FROM post_images;
DELETE FROM post_audio; 
DELETE FROM posts;
DELETE FROM beats;
DELETE FROM chapters;
DELETE FROM games;
DELETE FROM users;
DELETE FROM ai_gm_profiles;
DELETE FROM ai_gm_responses;
DELETE FROM ai_usage;
DELETE FROM game_players;
DELETE FROM player_game_requests;
DELETE FROM dice_rolls;
DELETE FROM archive_metadata;
DELETE FROM game_completions;
EOF

echo -e "${GREEN}✓ Local database cleared${NC}"

echo -e "${YELLOW}Step 4: Importing production data...${NC}"

# Import data in dependency order
echo "  - Importing users..."
sqlite3 "$LOCAL_DB" < temp_users.sql

echo "  - Importing games..."  
sqlite3 "$LOCAL_DB" < temp_games.sql

echo "  - Importing chapters..."
sqlite3 "$LOCAL_DB" < temp_chapters.sql

echo "  - Importing beats..."
sqlite3 "$LOCAL_DB" < temp_beats.sql

echo "  - Importing posts..."
sqlite3 "$LOCAL_DB" < temp_posts.sql

echo "  - Importing AI GM profiles..."
sqlite3 "$LOCAL_DB" < temp_ai_profiles.sql

echo -e "${GREEN}✓ Production data imported${NC}"

echo -e "${YELLOW}Step 5: Verifying data migration...${NC}"

# Count records in each table
echo "Data verification:"
echo "  Users: $(sqlite3 "$LOCAL_DB" "SELECT COUNT(*) FROM users;")"
echo "  Games: $(sqlite3 "$LOCAL_DB" "SELECT COUNT(*) FROM games;")"
echo "  Chapters: $(sqlite3 "$LOCAL_DB" "SELECT COUNT(*) FROM chapters;")"
echo "  Beats: $(sqlite3 "$LOCAL_DB" "SELECT COUNT(*) FROM beats;")"
echo "  Posts: $(sqlite3 "$LOCAL_DB" "SELECT COUNT(*) FROM posts;")"
echo "  AI GM Profiles: $(sqlite3 "$LOCAL_DB" "SELECT COUNT(*) FROM ai_gm_profiles;")"

echo -e "${YELLOW}Step 6: Cleaning up temporary files...${NC}"
rm -f temp_*.sql

echo
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Data Migration Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo
echo "Your localhost database now contains all production data."
echo "You can test the server locally before deploying to production."
echo
echo "To start localhost server:"
echo "  export AWS_REGION=eu-north-1 && export AWS_BUCKET_NAME=kuvatjakalat && node js/server_sqlite_new.js"
echo

# Make script executable
chmod +x migrate_production_data.sh