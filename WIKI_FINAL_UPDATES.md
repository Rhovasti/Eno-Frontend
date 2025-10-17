# Wiki UI - Final Updates

**Date:** October 1, 2025
**Status:** ✅ Complete - Ready for Content Population

---

## ✅ Updates Completed

### 1. Back Button Added

**Location:** Top right of header (same level as "Eno World Encyclopedia")

**Implementation:**
```html
<header>
    <h1>Eno World Encyclopedia</h1>
    <a href="/" class="back-to-main-btn">← Back to Main</a>
    <nav id="navBar">...</nav>
</header>
```

**Styling:**
- Semi-transparent background with border
- Hover effect: fills background, slides left
- Positioned with `margin-left: auto` to push to right side
- Smooth transition animations

**Files Modified:**
- `hml/wiki_dynamic_production.html` - Added link
- `css/wiki_dynamic_production.css` - Added `.back-to-main-btn` styles

---

## 📋 Content Expansion Task Created

**Task ID:** `e4642632-50e3-4e67-8738-f130dea677d4`
**Assignee:** User
**Priority:** Medium
**Status:** To Do

### Content Requirements

#### 🏛️ Locations (Multiple Scales)
**Buildings:**
- Floor plans with clickable rooms
- Temples, guild halls, libraries, academies
- Notable structures (Tower of Shadows, etc.)

**Districts:**
- City quarters (Market District, Temple Quarter, etc.)
- Neighborhood maps showing district within city
- Cultural/economic characteristics

**Cities/Citystates:**
- Full city entries: Palwede, Guild, Mahyapak, Ithemate, Jeong
- City-wide maps
- Population, culture, economy, governance

**Regions:**
- Valley entries (Night, Day, Dawn, Dusk)
- Regional maps
- Climate, culture, history

#### 📜 Historical Events
- Major battles and conflicts
- Treaties and alliances
- Founding events (cities, organizations)
- Natural disasters or magical cataclysms
- Events with varied durations:
  - Short: Days (3-10 days)
  - Medium: Weeks to months (10-100 days)
  - Long: Years to cycles (100+ days or multiple cycles)

#### 🎨 Concepts
- **Soul System:** Detailed hierarchy explanation
  - Primordial World Soul
  - Valley Souls (4 types)
  - Entity Souls
  - Individual Souls
  - Reincarnation mechanics

- **Magic Systems:**
  - Shadow Magic (Night Valley)
  - Light Magic (Day Valley)
  - Transition Magic (Dawn Valley)
  - Reflection Magic (Dusk Valley)

- **Economic Systems:**
  - Trade networks
  - Currency systems
  - Resource taxonomies
  - Luxury goods vs. necessities

- **Cultural Practices:**
  - Rituals and ceremonies
  - Belief systems per valley
  - Social structures

#### 👤 Characters/People

**Passport-Style Character Entries** (not traditional RPG stats)

Inspired by: https://chatgpt.com/share/68dcc395-bff8-8008-92ed-f86414aaf054

**Include:**
- Full name and aliases
- Physical appearance description
- Place of origin (valley, city)
- Current residence
- Occupation/role
- Organizational affiliations
- Biographical timeline (life events)
- Notable relationships
- Personality traits (descriptive, not numeric)

**Multi-Life-Cycle Souls:**
- Characters who have been reincarnated
- Timeline showing different lives
- Connections between incarnations
- Soul continuity across lives

**Example Categories:**
- Political leaders
- Merchants and traders
- Scholars and mages
- Artisans and craftspeople
- Religious figures
- Military commanders

### Data Structure Requirements

Each entry must include appropriate fields:

**Image Fields:**
```javascript
{
    // For locations
    "floorplan_image": "/images/floorplans/building_name.png",
    "district_map": "/images/districts/district_name.png",
    "city_map": "/images/cities/city_name.png",
    "map_image": "/images/maps/region_name.png",

    // For characters
    "portrait_image": "/images/portraits/character_name.png",
    "character_image": "/images/characters/character_full.png",

    // For concepts
    "concept_image": "/images/concepts/concept_name.png",
    "illustration_image": "/images/illustrations/concept_diagram.png",

    // For events
    "event_image": "/images/events/event_name.png",
    "painting_image": "/images/paintings/event_scene.png"
}
```

**Temporal Fields:**
```javascript
{
    "temporal_start_cycle": 0,          // Cycle when event/person existed
    "temporal_start_day": 1,            // Day within cycle
    "event_duration_days": 45,          // For events (affects timeline scale)
    "birth_cycle": 0,                   // For characters
    "birth_day": 150,
    "death_cycle": 2,                   // If applicable
    "death_day": 300
}
```

**Location Fields:**
```javascript
{
    "latitude": 1.37,                   // For map positioning
    "longitude": 10.94,
    "location_type": "citystate",       // building/district/citystate/region
    "location_id": "palwede"
}
```

**Relationship Fields:**
```javascript
{
    "related": ["entry-id-1", "entry-id-2", "entry-id-3"]  // For graph
}
```

### Content Goals

**Minimum Targets:**
- 30-50 comprehensive entries total
- 10+ locations (mix of scales)
- 8+ historical events (varied durations)
- 6+ concepts
- 15+ characters (including multi-life souls)

**Testing Coverage:**
- ✅ Timeline with day-level scale (short events)
- ✅ Timeline with cycle-level scale (long events)
- ✅ Timeline with life events (character biographies)
- ✅ Context images for all categories
- ✅ Related topics graph with 3+ connections
- ✅ Search and filtering across categories
- ✅ Multi-life-cycle tracking

---

## 📊 Expected UI Behavior with New Content

### Geography Entries
**Building Entry:**
- Context image: Floor plan
- Timeline: Construction date, renovations
- Related: District, City, Architect

**District Entry:**
- Context image: District map within city
- Timeline: Founding, major events
- Related: City, Buildings, Notable residents

**City Entry:**
- Context image: City map
- Timeline: Founding, growth, significant events
- Related: Region, Districts, Ruler, Economy

### Character Entries
**Person Entry:**
- Context image: Portrait
- Timeline: Life events (birth, achievements, death)
- Related: Birthplace, Affiliations, Family

**Multi-Life Soul:**
- Context image: Current incarnation portrait
- Timeline: Multiple life spans across cycles
- Related: Previous lives, locations, organizations

### Event Entries
**Short Event (Battle):**
- Context image: Painting/depiction
- Timeline: Day-level scale (3-7 days)
- Related: Location, Participants, Outcome

**Long Event (War):**
- Context image: Map or painting
- Timeline: Cycle-level scale (years)
- Related: Cities, Leaders, Treaties

### Concept Entries
**Magic System:**
- Context image: Concept art/diagram
- Timeline: Hidden (no temporal data)
- Related: Valley, Practitioners, Examples

---

## 🎯 Character Design Philosophy

Based on the ChatGPT conversation, characters should be:

**Passport-Style** (Not Stats-Based)
- Focus on identity and biography
- Descriptive rather than numerical
- Emphasizes narrative over mechanics

**Traditional RPG:**
```
Strength: 18
Dexterity: 14
Constitution: 16
...
```

**Passport-Style:**
```
Name: [Full name and titles]
Appearance: [Physical description]
Origin: [Birthplace and culture]
Occupation: [Current role]
Affiliations: [Organizations, relationships]
Biography: [Life story, achievements]
Personality: [Traits, motivations]
```

**Benefits:**
- More immersive and realistic
- Better for narrative-driven gameplay
- Easier for non-gamers to understand
- Emphasizes character over combat

---

## 🚀 Next Steps

1. **Populate Database:**
   - Create database schema with new fields
   - Add image URL fields
   - Add temporal fields
   - Add location fields

2. **Generate Content:**
   - Write 30-50 wiki entries
   - Create or gather images for each type
   - Establish relationships between entries
   - Set appropriate temporal data

3. **Test UI:**
   - Verify timeline scales work correctly
   - Confirm context images display properly
   - Test related topics navigation
   - Validate search and filtering

4. **Deploy:**
   - Upload images to AWS S3
   - Populate database with entries
   - Deploy updated HTML/CSS/JS
   - Test in production

---

## 📝 Sample Entry Templates

### Location Entry (City)
```json
{
    "id": "palwede",
    "title": "Palwede",
    "category": "geography",
    "location_type": "citystate",
    "location_id": "palwede",
    "latitude": 1.45,
    "longitude": 10.92,
    "city_map": "/images/cities/palwede_map.png",
    "map_image": "/images/maps/night_valley_palwede.png",
    "excerpt": "A major port city in Night Valley with 47,137 inhabitants...",
    "content": "Full description...",
    "tags": ["city", "port", "night-valley", "trade"],
    "related": ["night-valley", "shadow-magic", "port-district"],
    "temporal_start_cycle": 0,
    "temporal_start_day": 50
}
```

### Character Entry (Passport-Style)
```json
{
    "id": "character-name",
    "title": "Character Full Name",
    "category": "characters",
    "portrait_image": "/images/portraits/character.png",
    "birth_cycle": 0,
    "birth_day": 150,
    "death_cycle": 2,
    "death_day": 300,
    "excerpt": "A renowned scholar from Night Valley...",
    "content": "**Name:** Full Name\n**Appearance:** Tall, dark hair, grey eyes\n**Origin:** Palwede, Night Valley\n**Occupation:** Scholar and Mage\n**Affiliations:** Shadow Academy, Merchant Guild\n**Biography:** Born in Palwede during cycle 0...",
    "tags": ["scholar", "mage", "night-valley", "palwede"],
    "related": ["palwede", "shadow-academy", "shadow-magic"]
}
```

### Event Entry (Battle)
```json
{
    "id": "battle-name",
    "title": "The Battle of X",
    "category": "history",
    "event_image": "/images/events/battle_x.png",
    "painting_image": "/images/paintings/battle_scene.png",
    "temporal_start_cycle": 1,
    "temporal_start_day": 200,
    "event_duration_days": 5,
    "latitude": 1.50,
    "longitude": 11.00,
    "excerpt": "A decisive battle between...",
    "content": "Full description of the battle...",
    "tags": ["battle", "war", "history", "night-valley"],
    "related": ["city-a", "city-b", "commander-a", "treaty-x"]
}
```

---

**Status:** ✅ UI complete with back button, Archon task created for content
**Ready for:** Content population and comprehensive testing

