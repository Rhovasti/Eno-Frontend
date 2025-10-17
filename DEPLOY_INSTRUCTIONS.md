# Production Deployment Instructions for Wiki with Eno World Tilemap

## Quick Deploy (Run on Production Server)

SSH into the production server (www.iinou.eu) and run:

```bash
cd /root/Eno-Frontend

# Pull latest changes from GitHub
git pull origin main

# Restart the Node.js server
pkill -f "node.*server_sqlite_new.js" || true
nohup node js/server_sqlite_new.js > server.log 2>&1 &
```

## What's Deployed

### New Features
1. **Dynamic Wiki System** - Full CRUD wiki at `/wiki_dynamic.html`
2. **Custom Eno World Tilemap** - Satellite imagery replacing Earth basemap
3. **Geospatial Integration** - Cities, villages, rivers, lakes layers
4. **Wiki-Map Linkage** - Location entries linked to map markers
5. **Relationship Graph** - D3.js visualization of wiki connections

### Files Changed
- `hml/wiki_dynamic.html` - New dynamic wiki interface
- `js/wiki_dynamic.js` - Wiki frontend logic with map integration
- `js/server_sqlite_new.js` - Added `/wiki_dynamic.html` route and wiki APIs

### External Resources
- **Tiles hosted at**: https://rhovasti.github.io/eno-tiles/
- **Tile format**: TMS (Tile Map Service) with Y-axis inversion
- **Zoom levels**: 0-8
- **Center coordinates**: [1.37, 10.94]

## Access URLs

- **Wiki Page**: https://www.iinou.eu/wiki_dynamic.html
- **Wiki API**: https://www.iinou.eu/api/wiki/*
- **Geo API**: https://www.iinou.eu/api/geo/*

## Database Notes

The wiki system will auto-create these tables on first run:
- `wiki_entries` - Main wiki content
- `wiki_entry_history` - Version tracking

Existing game data remains untouched.

## Verification

After deployment, verify:
1. Wiki page loads at `/wiki_dynamic.html`
2. Eno world tiles display (not Earth map)
3. Map layers toggle (cities, villages, etc.)
4. Wiki entries can be created/edited (admin only)
5. Search and category filtering work

## Troubleshooting

If tiles don't load:
- Check browser console for CORS errors
- Verify https://rhovasti.github.io/eno-tiles/0/0/0.png loads
- Ensure `tms: true` is set in the tile layer config

If wiki doesn't load:
- Check server logs: `tail -f server.log`
- Verify database permissions
- Check that port 3000 is running: `netstat -tlnp | grep 3000`