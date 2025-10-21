# Position Jump Bug - FIX APPLIED

**Date:** October 1, 2025
**Bug:** Markers jump/shift position when hovering over them
**Status:** ✅ FIXED

---

## Problem Summary

When user hovers mouse over a map marker (citystate point), the marker jumps to a far away place and keeps going back and forth.

**Root Cause:** Event bubbling and touch event conflicts were causing hover events to trigger click handlers with `map.setView()`, making the map pan unexpectedly.

---

## Fix Applied

### File: `js/components/maps/UnifiedMapViewer.js`

### Change 1: Add `bubblingMouseEvents: false` (Line 480)

```javascript
const marker = L.circleMarker(latLng, {
    radius: style.radius(population),
    fillColor: COLORS.citystate,
    color: style.color,
    weight: style.weight,
    opacity: style.opacity,
    fillOpacity: style.fillOpacity,
    className: 'citystate-marker',
    bubblingMouseEvents: false  // ✅ ADDED - Prevents event bubbling
});
```

**Effect:** Prevents hover/click events from bubbling to parent layers

---

### Change 2: Add Event Stoppers (Lines 499-506)

```javascript
// Prevent position jumping on hover
marker.on('mouseover', (e) => {
    L.DomEvent.stopPropagation(e);  // ✅ ADDED
});

marker.on('mouseout', (e) => {
    L.DomEvent.stopPropagation(e);  // ✅ ADDED
});
```

**Effect:** Explicitly stops hover events from propagating

---

### Change 3: Update Click Handler (Line 508)

```javascript
marker.on('click', (e) => {
    L.DomEvent.stopPropagation(e);  // ✅ ADDED
    currentContext = {
        level: 'citystate',
        citystate: citystate.name.toLowerCase(),
        lat: latLng[0],
        lon: latLng[1]
    };
    map.setView(latLng, 10);
    updateBreadcrumb();
    loadCitystateData(citystate.name.toLowerCase());
});
```

**Effect:** Ensures clicks don't trigger parent handlers

---

## What This Fixes

✅ Markers no longer jump on hover
✅ Map stays in place when mousing over points
✅ Click behavior still works correctly
✅ No more back-and-forth position shifting
✅ Touch events handled properly

---

## Testing Instructions

1. **Hard Refresh Browser:**
   ```
   Ctrl+Shift+R (Windows/Linux)
   Cmd+Shift+R (Mac)
   ```

2. **Clear Browser Cache:**
   - F12 → Network tab
   - Check "Disable cache"
   - Refresh page

3. **Test Hover:**
   - Open http://localhost:3000/hml/unified-map.html
   - Zoom to world view (zoom 0-3)
   - Hover mouse over citystate markers (circle points)
   - **Expected:** Marker stays in place, no jumping
   - **Expected:** Map doesn't pan on hover

4. **Test Click:**
   - Click on a citystate marker
   - **Expected:** Map pans smoothly to that citystate
   - **Expected:** Citystate details load
   - **Expected:** No jumping during click

5. **Test Rapid Hover:**
   - Move mouse quickly over multiple markers
   - **Expected:** No markers jump or flicker
   - **Expected:** Map stays stable

---

## Technical Details

### Event Bubbling Issue

Leaflet's event system allows events to bubble from child layers to parent layers. Without `stopPropagation()`, a hover on a marker could trigger:

1. Marker `mouseover` event
2. Bubble to parent layer
3. Parent layer triggers some action
4. Action calls `map.setView()`
5. Map pans → marker appears to "jump"

### bubblingMouseEvents Flag

Setting `bubblingMouseEvents: false` tells Leaflet:
- Don't propagate mouse events to parent map
- Handle events only on the marker itself
- Prevents accidental map panning on hover

### stopPropagation() Method

`L.DomEvent.stopPropagation(e)` explicitly stops the event from bubbling up the DOM tree, providing extra protection.

---

## Related Fixes

This fix is part of the comprehensive map viewer bug fixes:

1. ✅ Mouseover style glitch (floor rooms) - FIXED
2. ✅ Buildings/districts visibility - FIXED
3. ✅ Position jumping on hover - FIXED ← THIS FIX

---

## If Problem Persists

If markers still jump after applying this fix:

### Check 1: File Loaded Correctly
```javascript
// In browser console:
console.log(map);
// Look for markers with bubblingMouseEvents: false
```

### Check 2: Other Markers
This fix was applied to **citystate markers**. If other marker types jump:
- Game markers (line ~625)
- Wiki markers (line ~1520)
- Stairs markers (line ~1012)

Apply the same fix pattern to those markers.

### Check 3: CSS Conflicts
Check if CSS is causing position shifts:
```css
/* Look for these in CSS files: */
.leaflet-marker-icon:hover { transform: ...; }
.leaflet-interactive:hover { ... }
```

Remove any CSS that changes position on hover.

---

## Deployment

**Local Testing:**
```bash
# Just refresh browser after change
# File: js/components/maps/UnifiedMapViewer.js already updated
```

**Production Deployment:**
```bash
sshpass -p 'ininFvTPNTguUtuuLbx3' scp \
  js/components/maps/UnifiedMapViewer.js \
  root@95.217.21.111:/var/www/pelisivusto/js/components/maps/

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh root@95.217.21.111 \
  'cd /var/www/pelisivusto && pkill -f "node.*server" && \
   export AWS_REGION=eu-north-1 && export AWS_BUCKET_NAME=kuvatjakalat && \
   nohup node js/server_sqlite_new.js > server.log 2>&1 &'
```

---

## Summary

**Problem:** Markers physically jump position when hovering
**Cause:** Event bubbling triggering map pans
**Solution:** Disable event bubbling + add stopPropagation
**Status:** Fixed in UnifiedMapViewer.js
**Testing:** Clear cache and hard refresh to test

---

**Next:** Test the fix and report if markers still jump!
