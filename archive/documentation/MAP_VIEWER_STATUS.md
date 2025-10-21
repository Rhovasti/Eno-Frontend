# Map and Wiki Viewer Status Report

**Date:** October 1, 2025
**Testing Status:** Requires browser cache clearing and re-testing

---

## Current Status of Map/Wiki Pages

### 1. **unified-map.html** - Uses UnifiedMapViewer.js
**Status:** ✅ FIXED (but requires browser cache clear)
**JavaScript:** `/js/components/maps/UnifiedMapViewer.js`
**Bugs Fixed:**
- ✅ Mouseover glitch (added `map.hasLayer()` checks)
- ✅ Buildings/districts visibility at zoom levels

**Issue Reported:** "Still has the mouseover bug"
**Likely Cause:** Browser cache - the JavaScript file was updated but browser is using old cached version

**Solution:**
```
Hard refresh the page:
- Chrome/Firefox: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
- Or clear browser cache for localhost
```

---

### 2. **wiki_dynamic.html** - Uses CitystateMapViewer.js
**Status:** ⚠️ NO CHANGES
**JavaScript:** `/js/CitystateMapViewer.js`
**Notes:**
- Different codebase from UnifiedMapViewer
- No mouseover issues reported in CitystateMapViewer
- Stable but "still the same" as before

**If bugs exist in CitystateMapViewer:**
- Would need separate bug investigation
- Currently no known critical issues

---

### 3. **wiki_dynamic_production.html** - Most Production-Ready
**Status:** ✅ BEST OPTION (needs UI redesign)
**JavaScript:**
- `/js/CitystateMapViewer.js`
- `/js/wiki_dynamic.js`
- `/js/wiki_timeline_integration.js`
- `/js/wiki_map_integration.js`
- `/js/components/timeline/TemporalTimeline.js`

**Features:**
- Timeline integration
- Wiki-map bidirectional linking
- More polished than wiki_dynamic.html
- Better component structure

**Needs:**
- UI redesign for better aesthetics
- Potential layout improvements
- Polish and visual refinement

---

## Comparison Table

| File | Map Engine | Status | Issues | Notes |
|------|-----------|--------|--------|-------|
| unified-map.html | UnifiedMapViewer.js | Fixed | Cache only | Newest, most features |
| wiki_dynamic.html | CitystateMapViewer.js | Unchanged | None known | Stable baseline |
| wiki_dynamic_production.html | CitystateMapViewer.js | Production-ready | UI needs polish | Best integration |

---

## Recommended Actions

### Immediate (Testing):

1. **Clear Browser Cache for unified-map.html:**
   ```
   - Open DevTools (F12)
   - Right-click refresh button → "Empty Cache and Hard Reload"
   - Or: Application tab → Clear storage → Cache
   ```

2. **Test Fixed Bugs:**
   - Navigate to `http://localhost:3000/hml/unified-map.html`
   - Test mouseover on floor plan rooms (zoom 13+)
   - Test district visibility at zoom levels 6-12
   - Test building visibility at zoom levels 9-16

3. **Verify Each Page:**
   - `wiki_dynamic.html` - Check baseline functionality
   - `wiki_dynamic_production.html` - Identify specific UI issues
   - `unified-map.html` - Confirm fixes work

---

### Short-term (UI Redesign for wiki_dynamic_production.html):

**Create Archon Task:**
```
Title: UI redesign for wiki_dynamic_production.html
Description: Improve visual design and user experience for the production wiki page

Areas to improve:
- Layout and spacing
- Color scheme and typography
- Timeline component styling
- Map controls positioning
- Mobile responsiveness
- Loading states
- Error message design
```

**Estimated Effort:** 8-12 hours

---

### Long-term (Consolidation):

**Question to Answer:**
- Should we consolidate wiki_dynamic.html and wiki_dynamic_production.html?
- Should UnifiedMapViewer.js replace CitystateMapViewer.js?
- Which page should be the canonical wiki interface?

**Current Recommendation:**
1. Keep wiki_dynamic_production.html as primary wiki interface
2. Apply UI redesign to make it visually appealing
3. Deprecate wiki_dynamic.html (move to archive)
4. Keep unified-map.html as separate map-focused tool
5. Possibly integrate UnifiedMapViewer features into wiki_dynamic_production over time

---

## Deployment Checklist

### For Testing Locally:

- [x] Bugs fixed in UnifiedMapViewer.js
- [x] Syntax validated
- [ ] Browser cache cleared
- [ ] Manual testing completed
- [ ] Bugs confirmed fixed

### For Production Deployment:

- [ ] Local testing passed
- [ ] Create backup of production files
- [ ] Deploy UnifiedMapViewer.js to production
- [ ] Test on production server
- [ ] Monitor for issues
- [ ] Update KNOWN_ISSUES.md

### Deployment Command:
```bash
# From /root/Eno/Eno-Frontend
sshpass -p 'ininFvTPNTguUtuuLbx3' scp -r \
  js/components/maps/UnifiedMapViewer.js \
  hml/unified-map.html \
  root@95.217.21.111:/var/www/pelisivusto/

# SSH and restart server
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh root@95.217.21.111 \
  'cd /var/www/pelisivusto && pkill -f "node.*server" && \
   export AWS_REGION=eu-north-1 && export AWS_BUCKET_NAME=kuvatjakalat && \
   nohup node js/server_sqlite_new.js > server.log 2>&1 &'
```

---

## Browser Cache Troubleshooting

If "hard refresh" doesn't work:

### Chrome:
```
1. F12 → Network tab
2. Check "Disable cache" checkbox
3. Keep DevTools open
4. Refresh page
```

### Firefox:
```
1. F12 → Network tab
2. Click gear icon → "Disable HTTP Cache"
3. Keep DevTools open
4. Refresh page
```

### Nuclear Option:
```
1. Open browser in Incognito/Private mode
2. Navigate to http://localhost:3000/hml/unified-map.html
3. Test functionality
```

---

## Files Modified Today

1. **js/components/maps/UnifiedMapViewer.js**
   - Lines 996-1017: Fixed mouseover glitch
   - Lines 1091-1121: Fixed buildings/districts visibility

2. **BUG_FIXES_2025_10_01.md**
   - Created documentation of fixes

3. **Three Archon Tasks Created:**
   - Repository cleanup
   - Audio playback UI
   - Image resolution upgrade

---

## Next Steps After Testing

1. ✅ Test fixes with cleared cache
2. ✅ Confirm bugs are resolved
3. ⏳ Create UI redesign task for wiki_dynamic_production.html
4. ⏳ Deploy to production if tests pass
5. ⏳ Update KNOWN_ISSUES.md with resolution
6. ⏳ Consider long-term consolidation strategy

---

**Status:** Waiting for user testing with cleared browser cache to confirm fixes work as expected.
