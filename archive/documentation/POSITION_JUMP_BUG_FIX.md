# Position Jump Bug - Root Cause & Fix

**Date:** October 1, 2025
**Bug:** Markers jump to far away places when mouse hovers over them

---

## Root Cause

The bug is caused by **event handler conflicts** where hover/mouseover events are triggering click handlers that call `map.setView()`, causing the map to pan unexpectedly.

### Likely Scenarios:

**1. Touch/Mobile Event Confusion:**
- Touch events might fire both `mouseover` and `click`
- Hover on touch devices triggers click immediately
- `map.setView()` in click handler pans the map

**2. Leaflet Event Bubbling:**
- Mouseover events bubbling to parent layers
- Parent layers have click handlers with `setView()`
- Map pans before user actually clicks

**3. Popup Interaction:**
- Opening/closing popups might trigger position changes
- Popup positioning calculations interfere with marker position
- Z-index or positioning CSS causing reflow

---

## The Fix

### Option 1: Prevent Event Bubbling (Recommended)

Add `stopPropagation()` to prevent hover events from bubbling:

```javascript
// Around line 498-508, update click handler:
marker.on('click', (e) => {
    L.DomEvent.stopPropagation(e); // Prevent bubbling
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

// Also add mouseover event that does nothing (blocks parent handlers):
marker.on('mouseover', (e) => {
    L.DomEvent.stopPropagation(e);
});

marker.on('mouseout', (e) => {
    L.DomEvent.stopPropagation(e);
});
```

### Option 2: Disable bubblingMouseEvents

Add to marker options:

```javascript
// Around line 472, update marker creation:
const marker = L.circleMarker(latLng, {
    radius: style.radius(population),
    fillColor: COLORS.citystate,
    color: style.color,
    weight: style.weight,
    opacity: style.opacity,
    fillOpacity: style.fillOpacity,
    className: 'citystate-marker',
    bubblingMouseEvents: false // ADD THIS LINE
});
```

### Option 3: Debounce setView Calls

Prevent rapid map panning:

```javascript
// At top of file, add debounce helper:
let setViewDebounce = null;

// In click handler, wrap setView:
marker.on('click', (e) => {
    if (setViewDebounce) return; // Ignore if recently called

    setViewDebounce = setTimeout(() => {
        setViewDebounce = null;
    }, 500);

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

### Option 4: Use Proper Click vs Hover Detection

Distinguish between click and hover:

```javascript
let isHovering = false;

marker.on('mouseover', () => {
    isHovering = true;
});

marker.on('mouseout', () => {
    isHovering = false;
});

marker.on('click', (e) => {
    if (!isHovering) return; // Only process if actually hovering

    // ... rest of click handler
});
```

---

## Apply All Fixes Together (Comprehensive Solution)

This combines multiple strategies for maximum stability:

```javascript
// After line 480 in UnifiedMapViewer.js:

// Add hover state management
let isHovering = false;
let clickPending = false;

marker.on('mouseover', (e) => {
    L.DomEvent.stopPropagation(e);
    isHovering = true;
    // Optional: Add visual feedback
    if (map.hasLayer(marker)) {
        marker.setStyle({
            weight: 3,
            fillOpacity: 0.9
        });
    }
});

marker.on('mouseout', (e) => {
    L.DomEvent.stopPropagation(e);
    isHovering = false;
    // Revert visual feedback
    if (map.hasLayer(marker)) {
        marker.setStyle({
            weight: style.weight,
            fillOpacity: style.fillOpacity
        });
    }
});

marker.on('click', (e) => {
    L.DomEvent.stopPropagation(e);

    // Prevent double-clicks or rapid clicks
    if (clickPending) return;
    clickPending = true;
    setTimeout(() => { clickPending = false; }, 500);

    // Only proceed if marker is actually on the map
    if (!map.hasLayer(marker)) return;

    currentContext = {
        level: 'citystate',
        citystate: citystate.name.toLowerCase(),
        lat: latLng[0],
        lon: latLng[1]
    };

    // Use flyTo instead of setView for smoother animation
    map.flyTo(latLng, 10, {
        duration: 1.5,
        easeLinearity: 0.25
    });

    updateBreadcrumb();
    loadCitystateData(citystate.name.toLowerCase());
});
```

---

## Testing the Fix

After applying fixes, test:

1. **Hover without clicking:** Marker should NOT move
2. **Click once:** Map should pan smoothly to marker location
3. **Rapid hover on/off:** No jumping or flickering
4. **Mobile/touch:** Single tap should work, no accidental panning
5. **Zoom in/out while hovering:** Marker stays in place

---

## Implementation Priority

**Apply in this order:**

1. ✅ **Add `bubblingMouseEvents: false`** to all marker options (Quick win, 5 minutes)
2. ✅ **Add `stopPropagation()`** to click handlers (Medium effort, 15 minutes)
3. ✅ **Add debouncing** to prevent rapid clicks (Low effort, 10 minutes)
4. ⏳ **Add comprehensive hover management** (if needed, 30 minutes)

---

**Start with Option 2 (bubblingMouseEvents: false) - it's the simplest and most likely to fix the issue.**
