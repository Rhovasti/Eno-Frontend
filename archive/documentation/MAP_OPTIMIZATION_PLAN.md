# Map Optimization Plan for Eno World Vector Overlays

## Performance Issue Identified
- Zoom levels above 8 cause resource exhaustion on production server
- Detailed features (buildings, roads) at high zoom levels overwhelm browser memory
- Need to separate global overview from local detailed views

## Optimized Architecture

### 1. Global Map (Zoom 0-8)
- **Base Tiles**: Satellite and Relief basemaps only
- **Vector Overlays**: 
  - Cities (simple points/markers)
  - Villages (simple points/markers)
  - Rivers (simplified polylines)
  - Lakes (simplified polygons)
- **Max Zoom**: Hard limit at 8
- **Interaction**: Click city/village to open detailed view

### 2. Local Detail Views (Modal-based)
- **Trigger**: "View Details" button in city/village popup
- **Separate Map Instance**: Fresh Leaflet map in modal
- **Local Tile Server**: Pre-rendered city tiles at high zoom
- **Detailed Features**:
  - Buildings (full polygons)
  - Roads (generated network)
  - Districts (boundary polygons)
  - Fields (agricultural areas)
  - Trees (point markers)
  - Castles (special markers)
- **Performance**: Only load data for selected city
- **Memory Management**: Destroy map instance on modal close

### 3. Implementation Steps

#### Phase 1: Enforce Global Map Restrictions
```javascript
// In wiki_dynamic.js
this.map = L.map('mapContainer', {
    maxZoom: 8,  // Hard limit
    maxBoundsViscosity: 1.0
}).setView([1.37, 10.94], 6);

// Disable zoom beyond level 8
this.map.on('zoomend', function() {
    if (this.getZoom() > 8) {
        this.setZoom(8);
    }
});
```

#### Phase 2: Create City Detail Modal System
```javascript
class CityDetailViewer {
    constructor(cityName, cityData) {
        this.cityName = cityName;
        this.cityData = cityData;
        this.localMap = null;
        this.layers = {};
    }
    
    open() {
        // Create modal
        // Initialize local map
        // Load city-specific data
        // No global state pollution
    }
    
    close() {
        // Destroy map instance
        // Clear all layers
        // Free memory
    }
}
```

#### Phase 3: Optimize Data Loading
- **Lazy Loading**: Only fetch detailed data when modal opens
- **Data Caching**: Cache frequently accessed cities (5-minute TTL)
- **Progressive Enhancement**: Start with basic, add details as they load
- **Error Boundaries**: Graceful degradation if data unavailable

#### Phase 4: Server-Side Optimizations
- **Pre-process GeoJSON**: Simplify geometries for global view
- **Tile Pre-rendering**: Generate static tiles for city details
- **CDN Integration**: Serve tiles from CDN for better performance
- **Compression**: Enable gzip for GeoJSON responses

### 4. Performance Targets
- Global map loads in < 2 seconds
- City detail modal opens in < 1 second
- Memory usage stays below 200MB
- Support 100+ concurrent users
- Zero crashes from zoom operations

### 5. Testing Strategy
- Test with Chrome DevTools Performance Monitor
- Monitor memory usage during zoom operations
- Stress test with multiple city modals
- Verify cleanup after modal close
- Test on low-end devices

### 6. Fallback Strategy
- If detailed view fails, show simple info panel
- Provide download link for city data
- Option to disable vector overlays entirely
- Static image fallback for complex cities

### 7. Future Enhancements
- WebGL rendering for better performance (Mapbox GL JS)
- Vector tile server for dynamic styling
- Level-of-detail (LOD) system for smooth transitions
- Clustered markers for dense areas
- Offline support with IndexedDB caching

## Implementation Priority
1. ✅ Rollback to stable version (COMPLETE)
2. Add zoom restriction enforcement
3. Create basic city detail modal
4. Implement lazy data loading
5. Add memory management
6. Test and optimize
7. Deploy to production

## Success Metrics
- No performance degradation at any zoom level
- Detailed city views load quickly
- Memory usage remains stable
- User experience improved with focused detail views
- Production server remains responsive