# Planned Features for Eno Game Platform

## Overview
This document outlines four major planned features to enhance the Eno game platform experience, focusing on AI-powered game mastering, audio immersion, and improved game management.

---

## 🎵 Feature 1: AI-Generated Background Sounds/Music for GM Posts

### Description
Integrate Stability AI's audio generation API to allow Game Masters to generate ambient sounds and music for their posts, creating immersive audio experiences.

### User Experience
- GM creates a post describing a scene
- Optional "🎵 Generate Background Audio" button appears
- GM can specify audio type: "ambient forest", "tavern music", "battle sounds", etc.
- Generated audio file plays automatically when players view the post
- Audio can be toggled on/off by players

### Technical Implementation

#### API Integration
- **Service**: Stability AI Audio API
- **Endpoint**: `https://api.stability.ai/v2alpha/generation/audio`
- **Models**: Stable Audio Open 1.0 or similar
- **Audio Formats**: WAV, MP3 (convert for web compatibility)

#### Database Schema
```sql
-- New table for generated audio
CREATE TABLE post_audio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    prompt TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    audio_type TEXT, -- 'ambient', 'music', 'sfx'
    duration INTEGER, -- in seconds
    file_size INTEGER,
    generation_params TEXT, -- JSON metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### Frontend Components
- Audio player widget in posts
- Volume controls
- Audio type selector for generation
- Preview before attaching to post

#### API Endpoints
```javascript
POST /api/posts/:postId/generate-audio
{
    "prompt": "forest ambience with bird sounds",
    "type": "ambient", // ambient, music, sfx
    "duration": 30 // seconds
}

GET /api/posts/:postId/audio
// Returns list of audio files for post
```

### Priority: Medium
### Estimated Development: 2-3 weeks

---

## 🤖 Feature 2: 14 AI Game Master Personalities with Portrait Selection

### Description
Create 14 distinct AI Game Master personalities using the existing portrait assets, each with unique game styles, personalities, and storytelling approaches.

### GM Personalities (Based on Available Portraits)

#### 1. **Aiva** - The Mystical Guide
- **Style**: Fantasy, mystical, ethereal
- **Personality**: Wise, mysterious, speaks in riddles
- **Specializes**: Magic-heavy campaigns, ancient mysteries

#### 2. **Almo** - The Tactical Commander  
- **Style**: Military, strategic, war campaigns
- **Personality**: Direct, authoritative, strategic
- **Specializes**: Combat scenarios, leadership challenges

#### 3. **Asta** - The Cheerful Adventurer
- **Style**: Light-hearted adventures, exploration
- **Personality**: Optimistic, encouraging, humorous
- **Specializes**: Discovery quests, feel-good stories

#### 4. **Aumir** - The Dark Scholar
- **Style**: Horror, dark fantasy, investigation
- **Personality**: Serious, ominous, intellectual
- **Specializes**: Mystery solving, supernatural horror

#### 5. **Erno** - The Seasoned Veteran
- **Style**: Classic fantasy, traditional D&D-style
- **Personality**: Experienced, fair, traditional
- **Specializes**: Balanced campaigns, classic tropes

#### 6. **Isti** - The Trickster
- **Style**: Comedy, chaos, unpredictable events
- **Personality**: Mischievous, witty, spontaneous
- **Specializes**: Comedy games, unexpected twists

#### 7. **Mara** - The Diplomat
- **Style**: Political intrigue, social conflicts
- **Personality**: Sophisticated, cunning, persuasive
- **Specializes**: Court intrigue, negotiation scenarios

#### 8. **Napa** - The Wilderness Guide
- **Style**: Survival, nature-based adventures
- **Personality**: Practical, nature-loving, survivalist
- **Specializes**: Outdoor adventures, survival challenges

#### 9. **Nula** - The Gentle Healer
- **Style**: Peaceful, character development focused
- **Personality**: Nurturing, empathetic, patient
- **Specializes**: Character growth, emotional stories

#### 10. **Omi** - The Scientist
- **Style**: Sci-fi, technology-based adventures
- **Personality**: Logical, curious, innovative
- **Specializes**: Space exploration, technology themes

#### 11. **Oona** - The Storyteller
- **Style**: Narrative-heavy, literature inspired
- **Personality**: Eloquent, dramatic, artistic
- **Specializes**: Epic narratives, character arcs

#### 12. **Pila** - The Young Prodigy
- **Style**: Modern, fast-paced, innovative
- **Personality**: Energetic, creative, unconventional
- **Specializes**: Modern settings, creative solutions

#### 13. **Sana** - The Spiritual Guide
- **Style**: Philosophical, spiritual journeys
- **Personality**: Calm, wise, introspective
- **Specializes**: Self-discovery, moral dilemmas

#### 14. **Vala** - The Warrior Poet
- **Style**: Epic battles, heroic sagas
- **Personality**: Noble, passionate, inspirational
- **Specializes**: Hero's journey, epic conflicts

### Technical Implementation

#### Database Schema
```sql
-- Expand ai_gm_profiles table
ALTER TABLE ai_gm_profiles ADD COLUMN portrait_filename TEXT;
ALTER TABLE ai_gm_profiles ADD COLUMN specialty_tags TEXT; -- JSON array
ALTER TABLE ai_gm_profiles ADD COLUMN sample_intro TEXT;
ALTER TABLE ai_gm_profiles ADD COLUMN difficulty_level INTEGER; -- 1-5

-- Seed data for 14 GMs
INSERT INTO ai_gm_profiles (name, personality_traits, game_style, portrait_filename, specialty_tags, sample_intro, difficulty_level) VALUES 
('Aiva', 'wise,mysterious,ethereal', 'mystical fantasy', 'aiva.png', '["magic","mysteries","fantasy"]', 'Welcome, seeker of ancient truths...', 3),
('Almo', 'strategic,authoritative,direct', 'military tactical', 'almo.png', '["combat","strategy","war"]', 'Soldiers, prepare for your mission...', 4),
-- ... (continue for all 14)
```

#### Frontend Components
- GM Selection Gallery (grid of portraits with names)
- GM Profile Modal (shows personality, style, sample intro)
- Preview Mode (see sample GM response before committing)
- GM Info Panel (during game, shows current GM stats)

#### AI Personality Implementation
```javascript
// GM personality prompts
const GM_PERSONALITIES = {
    'aiva': {
        systemPrompt: `You are Aiva, a mystical and wise game master. You speak in an ethereal, mysterious way, often referencing ancient knowledge and magical forces. Your descriptions are atmospheric and you enjoy weaving magic into every aspect of the story.`,
        responseStyle: 'mystical',
        preferredThemes: ['magic', 'ancient_mysteries', 'ethereal_beings']
    },
    // ... for each GM
};
```

### Priority: High
### Estimated Development: 3-4 weeks

---

## 💡 Feature 3: AI Suggestion Button for GM Posts

### Description
Add an AI-powered "Suggest" button that generates contextual GM post suggestions based on the current game state, helping GMs with writer's block or inspiration.

### User Experience
- GM is writing a new post
- Clicks "💡 Suggest Content" button
- AI analyzes current game context (recent posts, player actions, story state)
- Generates 2-3 different post suggestions
- GM can select one to use as a base and edit as needed
- Suggestions maintain the current GM's personality style

### Technical Implementation

#### Context Analysis
```javascript
// Analyze game context for suggestions
const analyzeGameContext = async (chapterId, beatId) => {
    // Get last 5 posts in current beat
    const recentPosts = await getRecentPosts(beatId, 5);
    
    // Get chapter description and objectives
    const chapter = await getChapter(chapterId);
    
    // Get player character actions/mentions
    const playerActions = extractPlayerActions(recentPosts);
    
    return {
        recentEvents: recentPosts.map(p => p.content),
        currentObjective: chapter.description,
        playerActions: playerActions,
        storyTension: analyzeTension(recentPosts)
    };
};
```

#### Suggestion Generation
```javascript
// Generate contextual suggestions
const generateGMSuggestions = async (context, gmPersonality) => {
    const prompt = `
    As ${gmPersonality.name}, analyze this game situation and suggest 3 different GM responses:
    
    Recent events: ${context.recentEvents.join('. ')}
    Current objective: ${context.currentObjective}
    Player actions: ${context.playerActions.join(', ')}
    Story tension level: ${context.storyTension}
    
    Generate 3 distinct GM post suggestions:
    1. Action-focused (move the plot forward)
    2. Character-focused (develop NPCs or player relationships)  
    3. World-building (expand the setting or lore)
    
    Each suggestion should be 2-3 paragraphs, match your personality, and create engaging player choices.
    `;
    
    return await callAIService(prompt, gmPersonality);
};
```

#### Frontend Components
- Suggestion button in GM post creation form
- Suggestion modal with 3 options
- Preview and edit functionality
- "Use this suggestion" action

#### API Endpoints
```javascript
POST /api/chapters/:chapterId/beats/:beatId/suggest-post
{
    "gm_personality_id": 1,
    "context_depth": 5 // how many recent posts to analyze
}

// Returns
{
    "suggestions": [
        {
            "type": "action",
            "title": "Advance the Plot",
            "content": "As the ancient door creaks open..."
        },
        {
            "type": "character", 
            "title": "Develop Relationships",
            "content": "The tavern keeper approaches with concern..."
        },
        {
            "type": "worldbuilding",
            "title": "Expand the World", 
            "content": "The distant bells of the cathedral..."
        }
    ]
}
```

### Priority: Medium
### Estimated Development: 2 weeks

---

## 📚 Feature 4: Chapter Archiving and Completed Games Display

### Description
Restore and enhance the chapter archiving system, adding a dedicated "Storyboard" page that shows completed chapters and finished games for players to review their gaming history.

### User Experience
- GMs can archive completed chapters with a summary
- Archived chapters appear in a special "Completed" section
- Storyboard page shows game timeline with completed/active chapters
- Players can browse their gaming history
- Export completed games as readable format (PDF, markdown)

### Technical Implementation

#### Database Schema (Restore/Enhance)
```sql
-- Enhance existing chapters table
ALTER TABLE chapters ADD COLUMN completion_summary TEXT;
ALTER TABLE chapters ADD COLUMN completion_date DATETIME;
ALTER TABLE chapters ADD COLUMN archive_reason TEXT; -- 'completed', 'abandoned', 'paused'

-- New table for game completion tracking
CREATE TABLE game_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    completed_by_user_id INTEGER NOT NULL,
    completion_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    final_summary TEXT,
    total_chapters INTEGER,
    total_posts INTEGER,
    duration_days INTEGER,
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (completed_by_user_id) REFERENCES users(id)
);

-- Archive metadata
CREATE TABLE archive_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL,
    archive_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    archived_by_user_id INTEGER NOT NULL,
    archive_narrative TEXT, -- GM's closing narrative
    player_achievements TEXT, -- JSON of player accomplishments
    notable_moments TEXT, -- JSON of highlighted posts/moments
    FOREIGN KEY (chapter_id) REFERENCES chapters(id),
    FOREIGN KEY (archived_by_user_id) REFERENCES users(id)
);
```

#### Archive Process
```javascript
// Enhanced chapter archiving
const archiveChapter = async (chapterId, archiveData) => {
    const {
        completionSummary,
        archiveReason,
        archiveNarrative,
        playerAchievements,
        notableMoments
    } = archiveData;
    
    // Update chapter
    await updateChapter(chapterId, {
        is_archived: true,
        completion_summary: completionSummary,
        completion_date: new Date(),
        archive_reason: archiveReason
    });
    
    // Save archive metadata
    await createArchiveMetadata({
        chapter_id: chapterId,
        archive_narrative: archiveNarrative,
        player_achievements: JSON.stringify(playerAchievements),
        notable_moments: JSON.stringify(notableMoments)
    });
    
    // Check if this completes the game
    await checkGameCompletion(gameId);
};
```

#### Storyboard Page Features
- **Timeline View**: Visual timeline of game progression
- **Chapter Cards**: Expandable cards showing chapter summaries
- **Statistics**: Game duration, post counts, player participation
- **Export Options**: PDF, markdown, or plain text export
- **Search/Filter**: Find specific games, chapters, or timeframes

#### Frontend Components
```javascript
// Storyboard page components
- GameTimeline (visual progression)
- ChapterCard (expandable chapter display)
- ArchiveModal (for archiving process)
- ExportDialog (download options)
- StatisticsPanel (game statistics)
- FilterSidebar (search and filter)
```

#### API Endpoints
```javascript
POST /api/chapters/:chapterId/archive
{
    "completion_summary": "The heroes saved the village...",
    "archive_reason": "completed",
    "archive_narrative": "As the dust settles...",
    "player_achievements": ["saved_villagers", "defeated_dragon"],
    "notable_moments": [{"post_id": 123, "description": "Epic battle"}]
}

GET /api/games/:gameId/storyboard
// Returns complete game timeline with archived chapters

GET /api/users/:userId/gaming-history
// Returns user's completed games and chapters

POST /api/games/:gameId/export
{
    "format": "pdf", // pdf, markdown, txt
    "include_archived": true,
    "include_metadata": true
}
```

#### Archive Display Features
- **Completed Badge**: Visual indicator for archived chapters
- **Archive Date**: When chapter was completed
- **Completion Summary**: Brief GM summary of events
- **Player Achievements**: Highlight player accomplishments
- **Notable Moments**: Links to memorable posts
- **Statistics**: Posts count, duration, participation

### Priority: High
### Estimated Development: 2-3 weeks

---

## 🚀 Implementation Roadmap

### Phase 1: Chapter Archiving Enhancement (Weeks 1-2) ⚡ HIGH PRIORITY
**Building on existing database archiving structure**

**Current Status:** 
- ✅ Database has `is_archived`, `archived_at`, `archived_narrative` columns
- ❌ Missing enhanced metadata and completion tracking
- ❌ Storyboard needs timeline redesign

**Implementation Tasks:**
1. **Database Schema Extensions**
   - Add `archive_metadata` table for completion summaries
   - Add `game_completions` table for finished games
   - Add completion tracking to existing chapters

2. **Enhanced Archive API**
   - Extend existing archive endpoints with metadata
   - Add export functionality (PDF, markdown)
   - Create gaming history endpoints

3. **Storyboard Redesign**
   - Transform static HTML to dynamic timeline view
   - Add completed game display
   - Implement export options

**Files to Create/Modify:**
- `js/server_sqlite_new.js` - Enhanced archive endpoints
- `hml/storyboard.html` - Timeline view redesign
- `js/storyboard.js` - New storyboard page logic
- `hml/threads.html` - Archive button for GMs

### Phase 2: AI GM Selection System (Weeks 3-6) ⚡ HIGH PRIORITY
**Leveraging existing 14 portrait files: aiva, almo, asta, aumir, erno, isti, mara, napa, nula, omi, oona, pila, sana, vala**

**Current Status:**
- ✅ 14 distinct portrait files ready
- ✅ AI integration exists (for content generation)
- ❌ No GM personality system
- ❌ No GM selection in game creation

**Implementation Strategy:**
1. **GM Personality Database**
   - Create `ai_gm_profiles` table with personality traits
   - Seed data for all 14 GM personalities
   - Link personalities to portrait files

2. **AI Service Integration**
   - Create `aiGMService.js` for personality-specific responses
   - Implement context-aware GM behavior
   - Add personality switching capability

3. **Frontend GM Selection**
   - Build GM selection gallery using existing portraits
   - Add GM profiles and preview system
   - Integrate with game creation process

**Files to Create/Modify:**
- `data/gm_personalities.json` - 14 GM personality definitions
- `js/services/aiGMService.js` - AI GM logic and personality handling
- `hml/gm-selection.html` - GM selection interface
- `hml/create-game.html` - Add GM selection to game creation

### Phase 3: GM Suggestion Feature (Weeks 7-8) 🔵 MEDIUM PRIORITY
**AI-powered assistance building on GM personality system**

**Current Status:**
- ❌ No context analysis system
- ❌ No suggestion generation
- ❌ Requires Phase 2 GM system completion

**Implementation Tasks:**
1. **Context Analysis Service**
   - Analyze recent posts for game state
   - Extract player actions and story tension
   - Determine current objectives and themes

2. **Suggestion Generation**
   - Generate 3 suggestion types: action, character, world-building
   - Use GM personality for consistent suggestions
   - Make suggestions editable before posting

3. **Frontend Integration**
   - Add suggestion button to GM post creation
   - Create suggestion modal with options
   - Implement suggestion preview and editing

**Files to Create/Modify:**
- `js/services/contextAnalysisService.js` - Analyze game context
- Extend `js/services/aiGMService.js` - Suggestion generation
- `hml/threads.html` - Suggestion modal UI
- `js/server_sqlite_new.js` - Suggestion API endpoint

### Phase 4: Audio Generation Integration (Weeks 9-12) 🔵 MEDIUM PRIORITY
**Extending existing Stability AI integration to audio**

**Current Status:**
- ✅ Stability AI account and API access
- ✅ S3 bucket for file storage
- ✅ Image generation service as template
- ❌ No audio API integration

**Implementation Strategy:**
1. **Audio Service Development**
   - Use existing Stability AI account for audio API
   - Store audio files in existing S3 bucket
   - Follow patterns from `imageService.js`

2. **Database and Storage**
   - Add `post_audio` table for audio metadata
   - Implement audio file management
   - Add audio cleanup policies

3. **Frontend Audio Player**
   - Add audio player components to posts
   - Create audio generation UI for GMs
   - Implement audio controls and settings

**Files to Create/Modify:**
- `js/services/audioService.js` - Stability Audio API integration
- `hml/threads.html` - Audio player UI components
- `js/server_sqlite_new.js` - Audio generation endpoints
- Database schema updates for audio metadata

### Total Estimated Timeline: 12 weeks

**Priority Implementation Order:**
1. **Week 1-2:** Chapter Archiving (Foundation for all other features)
2. **Week 3-6:** AI GM System (Major user experience enhancement)
3. **Week 7-8:** GM Suggestions (Builds on AI GM system)
4. **Week 9-12:** Audio Generation (Enhancement feature)

---

## 📋 Technical Requirements

### Dependencies
- **Stability AI Audio API** access and credits
- **Enhanced AI service** integration (Claude/GPT with larger context)
- **Audio storage** solution (AWS S3 or similar)
- **PDF generation** library (for exports)
- **Enhanced database** schema migrations

### Infrastructure
- **Audio CDN** for fast audio delivery
- **Background processing** for audio generation
- **Caching layer** for GM suggestions
- **Export service** for game history

### Security Considerations
- **Audio file validation** (prevent malicious uploads)
- **GM personality isolation** (prevent cross-GM data leakage)
- **Export rate limiting** (prevent abuse)
- **Archive permissions** (only GMs can archive)

---

**Document Created**: 2025-06-07  
**Status**: Planned Features  
**Next Steps**: Prioritize and begin Phase 1 implementation