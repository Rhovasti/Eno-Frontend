# Wiki UI Tweaks - Version 2

**Date:** October 1, 2025
**Status:** ✅ Complete - Ready for Testing
**Based on:** User feedback image

---

## 🎯 User Feedback Summary

Based on the screenshot provided, the following modifications were requested:

### 1. **Search** ✅
- Already in right place and functional
- No changes needed

### 2. **Context Panel (Right Sidebar)** 🔄
- **Before**: Always showed interactive map + timeline
- **After**: Shows static contextual image based on topic type

**Image Types by Category:**
- **Geography (City)**: City map view
- **Geography (District)**: District outline within city
- **Geography (Building)**: Floor plan
- **Person/Character**: Portrait
- **Concept (Magic/Mythology)**: Concept art
- **Event (History)**: Painting-style depiction
- **Organization**: Emblem/symbol
- **Culture**: Cultural art
- **Economics**: Diagrams/charts

**Interactions:**
- Click image → Opens full gallery or interactive map
- "View More Images" button for additional content

### 3. **Timeline Repositioning** 🔄
- **Before**: Right sidebar (always visible)
- **After**: Below topic content (conditionally shown)

**Conditional Display:**
- **Person**: Life cycle and important events
- **Location**: Founding and historical events
- **History**: Event timeline
- **Concept/Magic**: Hidden (no timeline unless temporal data exists)

**Scale Flexibility:**
- Events spanning multiple cycles: Cycle-level scale
- Short events (days): Day-level scale
- Life events: Decade/year scale
- Displays scale info text

### 4. **Related Topics Navigation** 🔄
- **Before**: At bottom as button list
- **After**: At top as N4L-styled mini-graph

**Style:**
- Node-and-edge presentation
- Nodes represented as ○ with labels
- Edges shown as — connectors
- Clickable nodes for navigation
- Compact horizontal layout

---

## 🔧 Technical Implementation

### CSS Changes

**1. Context Image Panel**
```css
.context-image-panel {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border-secondary);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    box-shadow: var(--shadow-md);
}

.context-image-container {
    height: 450px;
    border-radius: var(--radius-md);
    background: var(--color-bg-secondary);
}

.context-image-container img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    cursor: pointer;
    transition: transform var(--transition-base);
}

.view-more-images-btn {
    background: var(--color-primary);
    color: white;
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
}

.image-type-badge {
    position: absolute;
    top: var(--space-sm);
    right: var(--space-sm);
    background: rgba(90, 71, 56, 0.9);
    color: white;
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
}
```

**2. Related Topics Mini-Graph**
```css
.topic-related-graph {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    margin-bottom: var(--space-xl);
    max-height: 150px;
}

.related-node {
    background: white;
    border: 2px solid var(--color-primary-light);
    border-radius: var(--radius-md);
    padding: var(--space-xs) var(--space-sm);
    cursor: pointer;
}

.related-node::before {
    content: '○';
    font-size: var(--font-size-md);
}

.node-edge {
    color: var(--color-border-primary);
    font-size: var(--font-size-xs);
}
```

**3. Timeline Below Content**
```css
.topic-timeline-section {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border-secondary);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    margin-top: var(--space-2xl);
    box-shadow: var(--shadow-md);
}

.topic-timeline-section.hidden {
    display: none;
}

.timeline-scale-info {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    margin-top: var(--space-sm);
    font-style: italic;
}
```

### HTML Changes

**Before (Right Sidebar):**
```html
<aside class="context-panel">
    <div class="context-map"><!-- Map --></div>
    <div class="context-timeline"><!-- Timeline --></div>
</aside>
```

**After (Right Sidebar):**
```html
<aside class="context-panel">
    <div class="context-image-panel">
        <h3 id="contextImageTitle">Context</h3>
        <div class="context-image-container" id="contextImageContainer">
            <!-- Image or placeholder -->
        </div>
        <button class="view-more-images-btn" id="viewMoreImagesBtn">
            📷 View More Images / Interactive Map
        </button>
    </div>
</aside>
```

### JavaScript Changes

**1. Image Type Detection**
```javascript
getContextImageConfig(entry) {
    let imageUrl = null;
    let typeLabel = 'Context';
    let title = 'Context';

    switch (entry.category) {
        case 'geography':
            if (entry.location_type === 'building') {
                imageUrl = entry.floorplan_image;
                typeLabel = 'Floor Plan';
            } else if (entry.location_type === 'district') {
                imageUrl = entry.district_map;
                typeLabel = 'District Map';
            } else if (entry.location_type === 'citystate') {
                imageUrl = entry.city_map;
                typeLabel = 'City Map';
            }
            break;
        case 'characters':
            imageUrl = entry.portrait_image;
            typeLabel = 'Portrait';
            break;
        case 'magic':
        case 'mythology':
            imageUrl = entry.concept_image;
            typeLabel = 'Concept Art';
            break;
        // ... etc
    }

    return { imageUrl, typeLabel, title };
}
```

**2. Related Topics Graph**
```javascript
const relatedGraphHTML = (entry.related && entry.related.length > 0) ? `
    <div class="topic-related-graph">
        <h4>Related Topics</h4>
        <div class="related-nodes-container">
            ${entry.related.map((relId, index) => {
                const relEntry = this.entries.find(e => e.id === relId);
                if (!relEntry) return '';
                return `
                    ${index > 0 ? '<span class="node-edge">—</span>' : ''}
                    <div class="related-node" data-entry-id="${relId}">
                        ${relEntry.title}
                    </div>
                `;
            }).join('')}
        </div>
    </div>
` : '';
```

**3. Conditional Timeline**
```javascript
shouldShowTimeline(entry) {
    // Don't show timeline for concepts without temporal data
    if (entry.category === 'magic' || entry.category === 'mythology') {
        return entry.temporal_start_cycle !== undefined ||
               entry.temporal_start_day !== undefined;
    }

    // Show for geography, history, characters, organizations, culture, economics
    return ['geography', 'history', 'characters', 'organizations',
            'culture', 'economics'].includes(entry.category);
}
```

**4. Timeline Scale Configuration**
```javascript
getTimelineConfig(entry) {
    let zoomLevel = 3; // Default: cycles
    let scaleInfo = 'Timeline scale: Cycles';

    if (entry.category === 'characters') {
        zoomLevel = 5;
        scaleInfo = 'Timeline scale: Life events (zoomed to decades)';
    } else if (entry.category === 'history') {
        if (entry.event_duration_days && entry.event_duration_days < 100) {
            zoomLevel = 6;
            scaleInfo = `Timeline scale: Event duration (~${entry.event_duration_days} days)`;
        } else {
            zoomLevel = 4;
            scaleInfo = 'Timeline scale: Historical period (cycles)';
        }
    }

    return { zoomLevel, scaleInfo };
}
```

---

## 📊 Layout Comparison

### Before (V1)
```
Left: Topic List (280px)
Middle: Topic Detail (flexible)
Right: Map (400px) + Timeline (flexible)
```

### After (V2)
```
Left: Topic List (280px)
Middle: Related Graph + Topic Detail + Timeline (flexible)
Right: Context Image (400px)
```

---

## 🎨 Image Data Structure

For the system to work, wiki entries need image fields:

### Geography Entries
```json
{
    "id": "palwede-city",
    "category": "geography",
    "location_type": "citystate",
    "city_map": "/images/maps/palwede_city_map.png",
    "map_image": "/images/maps/palwede_region.png"
}
```

### Character Entries
```json
{
    "id": "character-name",
    "category": "characters",
    "portrait_image": "/images/portraits/character.png",
    "character_image": "/images/characters/character_full.png"
}
```

### Concept Entries
```json
{
    "id": "soul-system",
    "category": "mythology",
    "concept_image": "/images/concepts/soul_system.png",
    "illustration_image": "/images/illustrations/soul_hierarchy.png"
}
```

### Event Entries
```json
{
    "id": "great-battle",
    "category": "history",
    "event_image": "/images/events/great_battle.png",
    "painting_image": "/images/paintings/battle_scene.png",
    "event_duration_days": 45
}
```

---

## 🧪 Testing Checklist

### Visual
- [ ] Context image displays for each category type
- [ ] Related topics graph shows at top
- [ ] Timeline shows below content (when applicable)
- [ ] Timeline hidden for concepts without temporal data
- [ ] Image badge shows type label
- [ ] "View More" button visible when image present

### Functional
- [ ] Click topic → image updates in context panel
- [ ] Click related node → navigates to topic
- [ ] Click context image → opens gallery/map
- [ ] "View More" button → opens appropriate view
- [ ] Timeline initializes with correct scale
- [ ] Timeline scale info displays correctly

### Category-Specific
- [ ] Geography → Shows map (city/district/building)
- [ ] Character → Shows portrait
- [ ] Magic/Mythology → Shows concept art
- [ ] History → Shows event painting
- [ ] Organization → Shows emblem
- [ ] Culture → Shows cultural art
- [ ] Economics → Shows diagram

### Timeline Behavior
- [ ] Character → Life events timeline (decade scale)
- [ ] History (short) → Event timeline (day scale)
- [ ] History (long) → Period timeline (cycle scale)
- [ ] Geography → Location history timeline
- [ ] Concept → No timeline (unless temporal data)

---

## 🔮 Future Enhancements

### Short-term
- Add image gallery modal
- Support multiple images per topic
- Add image zoom functionality
- Add image caption text

### Long-term
- AI-generated concept art for topics without images
- Interactive floor plans (clickable rooms)
- Animated timeline events
- 3D model viewer for buildings/objects
- Image upload interface for editors

---

## 📝 Migration Notes

### For Existing Entries
1. Add image fields to database schema
2. Populate with placeholder images
3. Gradually replace with actual images
4. Update API to include image URLs

### Image Storage
- Store in AWS S3 (like current system)
- Organize by category: `/images/{category}/{id}.png`
- Support multiple formats: PNG, JPG, SVG
- Generate thumbnails for performance

---

## 🎯 Key Benefits

### User Experience
- ✅ Visual context immediately apparent
- ✅ Appropriate image type for each category
- ✅ Timeline only when relevant
- ✅ Easy navigation via related topics
- ✅ Flexible timeline scales

### Performance
- ✅ Lazy image loading
- ✅ Conditional timeline initialization
- ✅ Lighter right sidebar (no map tiles)
- ✅ Efficient mini-graph rendering

### Maintainability
- ✅ Clear image type logic
- ✅ Extensible category system
- ✅ Modular timeline configuration
- ✅ Reusable components

---

**Status:** ✅ Implementation complete, ready for testing
**Next:** Add image URLs to database, test with real data, deploy to production
