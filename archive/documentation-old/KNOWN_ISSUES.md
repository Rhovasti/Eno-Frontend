# Known Issues & Minor Bugs

## 🐛 Current Issues

### Repository Cleanup Needed (High Priority)
**Status:** Known, Needs Action  
**Description:** The repository contains many redundant scripts and old configuration files:
- Multiple deployment scripts with overlapping functionality
- Outdated server versions (server.js, server_sqlite.js variations)
- Old backup files and test scripts scattered throughout
- Configuration files for different environments mixed together

**Impact:** Developer confusion, deployment uncertainty, maintenance overhead  
**Solution:** Move old files to `archive/` folder, keep only current production files  
**Priority:** Should be addressed before next major development cycle

### Image Generation Database Schema Error (High Priority)
**Status:** Active Bug, Production Impact  
**Description:** When creating games and generating images on production server:
- Error: "Virhe: Failed to save image info: SQLITE_ERROR: table post_images has no column named generation_params"
- Image generation succeeds but metadata fails to save
- May impact image retrieval and regeneration features

**Impact:** Images generate but metadata is lost  
**Solution:** Add missing `generation_params` column to production database  
**SQL Fix:** `ALTER TABLE post_images ADD COLUMN generation_params TEXT;`

### Audio Generation Missing Playback UI (Medium Priority)
**Status:** Known, Feature Gap  
**Description:** Sound generation is successful but there's no obvious way for players or GM to listen to generated audio:
- Audio files are created and stored
- No playback controls in the UI
- Users don't know when audio is ready
- No indication of audio availability in posts

**Impact:** Generated audio features unusable without playback interface  
**Solution:** Add audio player controls and status indicators to post interface

### Image Display After Generation (Minor)
**Status:** Known, Low Priority  
**Description:** After generating an AI image for a post, there's a small loading delay where:
- The post appears immediately in the thread
- The generated image takes a few extra seconds to appear in the post
- Refreshing the page shows both post and image correctly

**Impact:** Cosmetic only - no functionality lost  
**Workaround:** Wait a few seconds or refresh the page  
**Root Cause:** Timing between post reload and image loading

### Suboptimal Image Resolution (Medium Priority)
**Status:** Known, Improvement Needed  
**Description:** Currently using 512x512 resolution for SD 3.5 Medium generation
- Current: 512x512 (1:1 aspect ratio, 262,144 pixels)
- Optimal: 768x1152 (0.667 aspect ratio, 884,736 pixels) or 1152x768 (1.5 aspect ratio)

**Impact:** Lower quality AI generation than possible  
**Solution:** Update canvas and generation to use optimal resolutions  
**Reference:** SD 3.5 Medium performs best at 768x1152/1152x768 resolutions  

### Duplicate Game Ordering Pages (Medium Priority)
**Status:** Known, Needs Consolidation  
**Description:** Players currently have two different pages to create AI GM games:
- `/hml/gm-selection.html` - Dedicated GM selection with detailed profiles
- `/hml/order-game.html` - Game ordering with GM selection embedded

**Impact:** User confusion, duplicate functionality  
**Solution:** Consolidate into single, clear game creation flow  
**Recommendation:** Keep gm-selection.html as primary interface, redirect from order-game or merge features

### Game Initiation Needs Enhancement (High Priority)
**Status:** Known, Feature Gap  
**Description:** Current game creation only asks for basic info (name, description, genre). Initial game experience lacks:
- Opening scene image generation
- Rich backstory/setting description  
- Clear initial choices for players
- Immersive atmosphere setting
- Future: Background music/soundscape integration

**Impact:** Games start with minimal context and engagement  
**Solution:** Enhance AI GM initial post generation to include:
1. Generated scene-setting image
2. Rich environmental description
3. Character/situation context  
4. Multiple meaningful choice options for players
5. Integration hooks for future audio features

### Server Stability
**Status:** Ongoing  
**Description:** The Node.js server occasionally stops responding and needs to be restarted
**Solution:** Use the restart command from `testserver.md`:
```bash
export AWS_REGION=eu-north-1 && export AWS_BUCKET_NAME=kuvatjakalat && node js/server_sqlite_new.js &
```

## ✅ Recently Fixed Issues

### Style Preset Validation Error (Fixed: 2025-06-07)
- **Issue:** Stability AI rejected 'sketch' as invalid style_preset
- **Solution:** Use 'line-art' as base style for all sketch generations
- **Status:** Resolved

### Posts Not Appearing After Creation (Fixed: 2025-06-07)
- **Issue:** New posts weren't visible until page refresh
- **Root Cause:** Beats endpoint only showed first post per beat
- **Solution:** Modified endpoint to return ALL posts in array
- **Status:** Resolved

### Database Schema Mismatch (Fixed: 2025-06-07)
- **Issue:** Image generation failed due to wrong column names
- **Root Cause:** Server expected `metadata` and `game_id` columns that didn't exist
- **Solution:** Updated INSERT query to match actual table schema
- **Status:** Resolved

### Character Dropdown vs Sketch Input (Fixed: 2025-06-07)
- **Issue:** Old character-based image generation conflicted with new sketch system
- **Solution:** Replaced character dropdown with doodle canvas + style selection
- **Status:** Resolved

## 🔧 Workarounds & Tips

### Image Generation
- **Best Results:** Draw simple, clear sketches with bold strokes
- **Style Impact:** Use 'Comic' for colorful illustrations, 'Sketch' for line art
- **Prompt Tips:** Combine descriptive text with sketch for best control

### Server Management
- **Restart Required When:** localhost:3000 becomes unreachable
- **Environment Variables:** Must be exported before each restart
- **Logs:** Watch console output for Stability AI API errors

### Database
- **File Location:** `/root/Eno/Eno-Frontend/data/database.sqlite`
- **Backup:** Created automatically as `.backup` files
- **Reset:** Delete database file to recreate with fresh schema

## 📋 Testing Checklist

When reporting new issues, please test:

1. **Basic Functionality:**
   - [ ] Can login successfully
   - [ ] Can create posts
   - [ ] Posts appear in thread view
   
2. **Image Generation:**
   - [ ] Text-only generation works
   - [ ] Sketch + text generation works  
   - [ ] Style selection affects output
   - [ ] Images save to posts correctly

3. **Server Stability:**
   - [ ] Server responds to requests
   - [ ] No 500 errors in console
   - [ ] Environment variables loaded

## 📊 Performance Notes

### Expected Response Times
- **Post Creation:** < 1 second
- **Image Generation:** 10-15 seconds (normal for AI)
- **Page Loading:** < 2 seconds
- **Image Display:** 2-3 seconds after generation

### Resource Usage
- **Memory:** ~100MB for SQLite server
- **Storage:** Images stored on AWS S3
- **API Limits:** Stability AI rate limits may apply

## 🎯 Future Improvements

### Low Priority Enhancements
- Implement proper image loading states
- Add progress bars for AI generation
- Cache generated images locally
- Add batch image generation
- Implement image editing/regeneration

### GM Suggestion System Enhancements (Future)

#### Multi-Agent GM Co-Creator System (High Priority Future)
**Description:** Allow GMs to receive suggestions from any of the 14 Children of Eno personalities
**Proposed Implementation:**
- Add personality selector dropdown to GM assistance interface
- Each Child of Eno provides suggestions based on their unique perspective and gamemaster style
- Example: Sana (systematic world-builder) vs Pila (humorous trickster) would give very different plot suggestions
- Maintains personality consistency from AI GM system for human GM assistance

**Use Cases:**
- Sana: Detailed world-building and systematic plot development
- Mara: Character-focused, empathetic group dynamics suggestions  
- Vala: Challenging, competitive scenario creation
- Pila: Humorous, lighthearted plot twists and comic relief
- Nula: Mystical, dreamlike atmospheric suggestions
- (All 14 personalities available as creative consultants)

#### OpenRouter API Integration (Medium Priority Future)
**Description:** Expand AI model options for content generation beyond Claude
**Proposed Features:**
- Integrate OpenRouter API for access to multiple LLM providers
- Allow different models for different suggestion types (e.g., GPT-4 for creative writing, Claude for logical plot structure)
- Maintain Anthropic Claude as primary agent personality system
- Model selection based on task type and quality requirements

**Technical Implementation:**
- Add OpenRouter as secondary API provider
- Model routing logic based on suggestion type
- Fallback chain: OpenRouter → Anthropic → Placeholder
- Configuration via environment variables for model preferences

**Model Use Cases:**
- Creative writing: GPT-4 or Claude Sonnet for rich descriptions
- Logical puzzles: GPT-4 for complex challenge design
- Character dialogue: Specialized dialogue models
- Environmental descriptions: Image-text models for vivid scenes

### Planned Features

#### Multiple Aspect Ratio Support (High Priority)
**Description:** Add aspect ratio selection for different types of compositions
**Proposed Options:**
- **Portrait:** 768x1152 (2:3) - Current default, best for characters/scenes
- **Landscape:** 1152x768 (3:2) - Good for environments/panoramas  
- **Square:** 1024x1024 (1:1) - Balanced for general use

**Implementation Plan:**
1. Add aspect ratio dropdown to image generation form
2. Dynamically resize doodle canvas based on selection
3. Update imageService.js to pass selected aspect ratio to Stability AI
4. Modify image processing to handle different dimensions
5. Update CSS for responsive canvas sizing

**Use Cases:**
- Portrait: Character portraits, standing figures, tall buildings
- Landscape: Environment art, battle scenes, wide vistas
- Square: Social media friendly, balanced compositions

**Technical Requirements:**
- Canvas resize functionality in JavaScript
- Dynamic aspect ratio parameter in API calls
- Responsive CSS for different canvas dimensions
- Database metadata to store aspect ratio choice

### Architecture Improvements
- Migrate from AWS SDK v2 to v3
- Add proper error boundaries
- Implement WebSocket for real-time updates
- Add image compression options

---

**Last Updated:** 2025-06-08  
**Server Version:** SQLite New (server_sqlite_new.js)  
**Features:** Sketch + Style Transfer Image Generation, Audio Generation