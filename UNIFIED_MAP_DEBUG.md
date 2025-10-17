# Unified Map Mouseover Bug - Debug Report

**Date:** October 1, 2025
**Status:** Investigating persistent mouseover glitch after cache clear

---

## Problem Description

User reports that `unified-map.html` still has mouseover bugs even after:
1. Browser cache was cleared (hard refresh Ctrl+Shift+R)
2. Code was fixed in UnifiedMapViewer.js with `map.hasLayer()` checks

---

## What Was Fixed

**File:** `js/components/maps/UnifiedMapViewer.js`
**Lines:** 996-1017
**Fix Applied:** Added safety checks before applying hover styles

```javascript
// BEFORE:
layer.on('mouseover', function(e) {
    this.setStyle({ weight: 3, fillOpacity: 0.9 });
});

// AFTER:
const originalStyle = { weight: 2, fillOpacity: 0.7 };
layer.on('mouseover', function(e) {
    if (map.hasLayer(this)) {
        this.setStyle({ weight: 3, fillOpacity: 0.9 });
    }
});
```

---

## Possible Causes of Persistent Bug

### 1. **Different Feature Type Having Issues**

The fix was applied to **floor room polygons** only (lines 996-1017).

Other interactive features in UnifiedMapViewer.js:
- Citystate markers (L.circleMarker) - line ~472
- District polygons (L.geoJSON) - line ~737
- Building polygons (L.geoJSON) - line ~843
- Region polygons (L.geoJSON) - line ~1217
- Game markers (L.marker) - line ~625
- Wiki markers (L.marker) - line ~1520
- Stairs markers (L.circleMarker) - line ~1012

**These features don't have explicit hover handlers** but might have:
- Default Leaflet interactive behavior
- CSS hover effects causing visual glitches
- Z-index conflicts on hover

### 2. **CSS Conflicts**

Check if there are CSS rules causing hover glitches:
```css
/* Possible culprits in CSS files: */
.leaflet-interactive:hover { }
.citystate-marker:hover { }
.map-popup:hover { }
```

### 3. **Event Bubbling Issues**

Leaflet event propagation might cause:
- Multiple hover events firing
- Parent/child layer conflicts
- Popup interactions triggering hover state changes

### 4. **Zoom Level Transitions**

Glitches might occur during:
- Zoom in/out animations
- Layer add/remove during zoom changes
- Style recalculation mid-transition

---

## Diagnostic Steps

### Step 1: Identify Which Feature Type Glitches

**User Action Needed:**
1. Open unified-map.html
2. Identify EXACTLY which element has the glitch:
   - Circle markers (citystates, stairs)?
   - Polygon shapes (districts, buildings, regions)?
   - Floor plan room polygons?
   - Popup windows?
   - Control buttons?

3. At what zoom level does it occur?
   - World view (0-3)?
   - Regional view (4-5)?
   - Citystate view (6-8)?
   - District view (9-12)?
   - Building interior (13-16)?

### Step 2: Describe the Glitch

**What exactly happens?**
- Flickering on mouseover?
- Style doesn't revert on mouseout?
- Multiple elements highlight at once?
- Popup closes/opens unexpectedly?
- Marker jumps or moves?
- Color changes incorrectly?
- Border/outline glitches?

### Step 3: Check Browser Console

**Open DevTools (F12) → Console tab**

Look for errors like:
```
- Uncaught TypeError: Cannot read property 'setStyle'
- Leaflet error: Layer not found
- Cannot set style on removed layer
- Maximum call stack size exceeded
```

### Step 4: Network Tab Check

**DevTools → Network tab**

Verify UnifiedMapViewer.js loads correctly:
- Check file size matches (should be ~1950 lines)
- Check timestamp (should be Oct 1, 2025 or later)
- Check if 304 (cached) or 200 (fresh download)

---

## Additional Fixes to Try

### Fix 1: Add Hover Handlers to All Interactive Features

Add consistent hover behavior to citystates:

```javascript
// Around line 480, after creating citystate marker:
marker.on('mouseover', function() {
    if (map.hasLayer(this)) {
        this.setStyle({
            radius: this.options.radius * 1.2,
            weight: 3
        });
    }
});

marker.on('mouseout', function() {
    if (map.hasLayer(this)) {
        this.setStyle({
            radius: style.radius(population),
            weight: style.weight
        });
    }
});
```

### Fix 2: Disable Leaflet Default Interactive Behavior

Add to problematic markers:
```javascript
const marker = L.circleMarker(latLng, {
    // ... existing options ...
    interactive: true,
    bubblingMouseEvents: false // Prevent event bubbling
});
```

### Fix 3: Add CSS to Prevent Hover Glitches

```css
/* Add to unified-map CSS */
.leaflet-interactive {
    pointer-events: auto;
    transition: none; /* Disable CSS transitions */
}

.leaflet-marker-icon {
    transition: none;
}

.leaflet-popup {
    pointer-events: auto;
}
```

### Fix 4: Force Repaint After Hover

```javascript
layer.on('mouseout', function(e) {
    if (map.hasLayer(this)) {
        this.setStyle(originalStyle);
        // Force repaint
        this._updatePath?.();
    }
});
```

---

## Testing Script

Add this to browser console to test hover behavior:

```javascript
// List all interactive layers
map.eachLayer(layer => {
    if (layer.on) {
        console.log('Layer type:', layer.constructor.name);
        console.log('Has mouseover:', layer._events?.mouseover?.length > 0);
        console.log('Has mouseout:', layer._events?.mouseout?.length > 0);
    }
});

// Monitor hover events
let hoverCount = 0;
map.on('mouseover', (e) => {
    console.log(`Hover #${++hoverCount}:`, e.layer?.constructor.name);
});
```

---

## Next Actions

**If user can provide:**
1. **Specific element that glitches** (citystate? district? floor room?)
2. **Zoom level where it occurs**
3. **Exact glitch behavior** (flicker? stuck? wrong color?)
4. **Browser console errors** (if any)

**Then I can:**
- Apply targeted fix to the specific feature type
- Add proper hover handlers to all interactive elements
- Fix any event bubbling or CSS conflicts
- Test the specific scenario

---

## Files to Check

1. `/hml/unified-map.html` - Check if correct JS file is loaded
2. `/js/components/maps/UnifiedMapViewer.js` - Verify fixes are present
3. `/css/*` - Check for conflicting hover styles
4. Browser DevTools Console - Check for JavaScript errors
5. Browser DevTools Network - Verify file is loading fresh

---

**Current Status:** Waiting for detailed bug description from user to apply targeted fix.
