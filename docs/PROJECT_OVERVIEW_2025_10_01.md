# Eno Project Overview & Task Prioritization
**Date:** October 1, 2025
**Status:** Active Development

---

## 📊 Project Summary

The Eno Gaming & Worldbuilding Ecosystem is a comprehensive platform with:
- **Eno-Frontend**: Web-based text RPG platform (Node.js/SQLite)
- **Eno-Backend**: Narrative gaming backend (Python/Neo4j/ChromaDB)
- **Enonomics**: Economic worldbuilding generator
- **SSTorytime**: N4L knowledge graph database
- **simulation2**: World simulation system (Rust)
- **archon**: Project management with PRP methodology
- **Mundi**: Geospatial mapping tools

---

## 🎯 Current Focus: Eno-Frontend

### Primary Interface Decision
**wiki_dynamic_production.html** = Main wiki interface (production-ready, needs UI polish)
**unified-map.html** = Fullscreen map experience (has critical bugs, defer for now)

---

## 📋 Active Tasks in Archon (Todo Status)

### High Priority Tasks (Do First):

**1. UI Redesign - wiki_dynamic_production.html** ⭐ **RECOMMENDED NEXT**
- **Task ID:** 3e27684a-f2f4-45cf-9b87-ffcdb9b3b2aa
- **Effort:** 18-22 hours
- **Impact:** High - This is the primary user-facing interface
- **Status:** Ready to start
- **Why:** Best feature integration, just needs visual polish

**2. Repository Cleanup**
- **Task ID:** 60060966-184a-4121-a626-2cb3c1407767
- **Effort:** 4-6 hours
- **Impact:** Medium - Reduces developer confusion
- **Status:** Ready to start
- **Why:** Makes codebase more maintainable

**3. Audio Playback UI**
- **Task ID:** 70526bac-427f-4680-af3e-9c4d833466f6
- **Effort:** 6-8 hours
- **Impact:** Medium - Unlocks existing feature
- **Status:** Ready to start
- **Why:** Audio is being generated but unusable

**4. Image Resolution Upgrade (512→768x1152)**
- **Task ID:** b52d1165-78d2-4350-aa4d-1e783f8c04b8
- **Effort:** 4-6 hours
- **Impact:** Medium - Better image quality
- **Status:** Ready to start
- **Why:** Simple upgrade with immediate visual improvement

### Backend/System Tasks (Lower Priority):

**5. Notification System for Async Games**
- **Task ID:** 1189c253-4f0e-4f51-8cb1-d53f4e4c6452
- **Effort:** Large (multi-week)
- **Impact:** High but requires async game system first
- **Status:** Blocked by async game implementation

**6. Analytics Dashboard**
- **Task ID:** 39f124d0-0ba5-4cd7-906c-289b9b1facdb
- **Effort:** Large (multi-week)
- **Impact:** High but not immediately user-facing
- **Status:** Can be deferred

**7. Threading System Expansion**
- **Task ID:** 68a4d667-aced-4ed5-ab24-742c744affb6
- **Effort:** Large (multi-week)
- **Impact:** High but architectural change
- **Status:** Requires planning

**8. Async Narrative Generation Pipeline**
- **Task ID:** af616887-2c4a-4e23-bdec-0c17da47b0e9
- **Effort:** Large (multi-week)
- **Impact:** Very high - Core feature
- **Status:** Major system component

**9. Map Viewer TODOs (Deferred)**
- **Task ID:** ab7b1689-b998-4bbd-a3a4-d9f86f6799f8
- **Contains:** Position jumping bug (UNRESOLVED)
- **Status:** Defer indefinitely, use wiki_dynamic_production.html instead

---

## 🚀 Recommended Development Path

### Week 1-2: Polish & Quick Wins (38-48 hours)

**Phase 1: UI Polish (18-22 hours)**
✅ Focus on wiki_dynamic_production.html UI redesign
- Modern, clean interface
- Responsive design
- Timeline component polish
- Map integration styling
- Deliverable: Production-ready primary wiki interface

**Phase 2: Quick Wins (20-26 hours)**
✅ Repository cleanup (4-6 hours)
✅ Audio playback UI (6-8 hours)
✅ Image resolution upgrade (4-6 hours)
✅ Testing and bug fixes (6-6 hours)

**Outcome:** Clean codebase, polished main interface, unlocked features

---

### Week 3-4: Feature Development (Choose One)

**Option A: Content Creation Enhancement**
- Wiki editor page (16-24 hours)
- Wiki lat/lon support (4-6 hours)
- Enhanced wiki-map integration
- **Benefit:** Complete wiki system

**Option B: Game Experience Improvement**
- Game creation UI polish
- Character creation enhancements
- GM dashboard improvements
- **Benefit:** Better game flow

**Option C: Economic Integration**
- Economics dashboard (16-24 hours)
- Economic overlays on maps
- Data visualization
- **Benefit:** Rich worldbuilding data

---

### Month 2+: Major Systems (Long-term)

**After polish is complete, tackle:**
1. Async Narrative Generation Pipeline (Core feature)
2. Threading System Expansion (Architecture)
3. Notification System (User engagement)
4. Analytics Dashboard (Insights)

---

## 💡 Why This Path?

### Advantages:
1. **Quick visible progress** - UI improvements are immediately apparent
2. **Build momentum** - Small wins lead to bigger wins
3. **Clean foundation** - Repository cleanup prevents future confusion
4. **Unlock existing work** - Audio playback makes generated content usable
5. **User-facing first** - Focus on what users interact with
6. **Defer problem areas** - unified-map.html bug is time-sink, work around it

### Strategic Decisions:
- **Defer unified-map.html bug**: Too time-consuming, use alternative
- **Focus on wiki_dynamic_production.html**: Best ROI for effort
- **Quick wins build confidence**: 4-8 hour tasks feel achievable
- **Polish before features**: Better to have few polished features than many rough ones

---

## 📈 Success Metrics

### After Week 1-2:
- ✅ wiki_dynamic_production.html looks professional
- ✅ Codebase is organized and documented
- ✅ Audio playback works
- ✅ Images generate at higher quality
- ✅ No deployment confusion

### After Week 3-4:
- ✅ Complete wiki system OR
- ✅ Polished game experience OR
- ✅ Economic data integration

### Long-term:
- ✅ Async narrative generation working
- ✅ Multi-threaded content system
- ✅ User engagement through notifications
- ✅ Data-driven improvements via analytics

---

## 🎨 Design Philosophy

### For wiki_dynamic_production.html:
- Clean, modern aesthetic (Notion/Obsidian inspired)
- Consistent color palette
- Smooth transitions
- Mobile-first responsive
- Accessible (WCAG AA)
- Fast loading
- Cohesive with map viewer

### For All Development:
- User-facing improvements first
- Polish over quantity
- Document as you go
- Test on real devices
- Iterate based on feedback

---

## 🔧 Technical Debt to Address

### High Priority:
1. ✅ Repository cleanup (Week 1-2)
2. ⏳ Database schema documentation
3. ⏳ API endpoint documentation
4. ⏳ Error handling standardization

### Medium Priority:
5. Code splitting/modularization
6. Performance monitoring
7. Automated testing
8. Browser compatibility testing

### Low Priority:
9. Dark mode
10. Offline support
11. PWA features
12. Advanced analytics

---

## 📊 Resource Allocation

### Immediate (Next 2 weeks):
- 100% Frontend polish and quick wins
- Focus: wiki_dynamic_production.html + cleanup + audio + images

### Short-term (Weeks 3-4):
- 80% Feature development (wiki/game/economic)
- 20% Testing and refinement

### Long-term (Month 2+):
- 60% Major system development
- 30% Feature additions
- 10% Maintenance and bug fixes

---

## ✅ Decision Points

### Defer:
- ❌ unified-map.html position jumping bug (too costly)
- ❌ Major architectural changes (threading expansion)
- ❌ Advanced features (analytics, notifications) until core is solid

### Prioritize:
- ✅ UI/UX polish (wiki_dynamic_production.html)
- ✅ Code organization (repository cleanup)
- ✅ Unlock existing features (audio playback)
- ✅ Quick quality improvements (image resolution)

### Evaluate Later:
- ⏳ Wiki editor (depends on wiki system priority)
- ⏳ Economics dashboard (depends on Enonomics backend readiness)
- ⏳ Async narrative system (major feature, needs planning)

---

## 🎯 Immediate Next Action

**START HERE:**

```
Task: UI redesign and functional polish for wiki_dynamic_production.html
Task ID: 3e27684a-f2f4-45cf-9b87-ffcdb9b3b2aa
Estimated Effort: 18-22 hours
Priority: HIGH

Why: This is your primary user-facing interface with the best
feature integration. It just needs visual polish to be production-ready.
Completing this gives you a solid, professional foundation to build on.

After this: Repository cleanup → Audio playback → Image resolution
```

---

## 📝 Notes

- Position jumping bug documented in unified-map task
- wiki_dynamic_production.html confirmed as primary interface
- All quick wins (tasks #132-134) are ready to execute
- Major system tasks (#105, 107, 108, 113) deferred until foundation solid

---

**Status:** Ready to begin wiki_dynamic_production.html UI redesign
**Next Review:** After completing Week 1-2 tasks
**Long-term Goal:** Polished, user-friendly platform with solid foundation
