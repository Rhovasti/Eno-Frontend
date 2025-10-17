# Archive Directory Documentation

This document explains what files have been archived and why. Archived files are kept for reference but are no longer used in active development or production.

## Archive Structure

```
archive/
├── deployment-scripts/   # Old deployment scripts (pre-2025-09)
├── server-versions/      # Historical server.js versions
├── config-files/         # Old configuration files
├── test-scripts/         # Development test scripts
├── documentation/        # Superseded documentation
└── backups/              # Old backup directories
```

## Currently Active Files

### Production Server
- **Active:** `js/server_sqlite_new.js` (current production, 280KB, updated Sep 28 2025)
- **Archived:** All other server*.js variants in `archive/server-versions/`

### Primary Deployment Script
- **Active:** `deploy_complete_features.sh` (recommended for full deployments)
- **Active:** `production_restart.sh` (quick restart only)
- **Archived:** 100+ historical deployment scripts in `archive/deployment-scripts/`

### Documentation
- **Active:** `CLAUDE.md`, `productionserver.md`, `README.md`
- **Active:** Feature-specific docs (e.g., `WIKI_UI_*`, `MAP_*`)
- **Archived:** Historical status documents moved to `archive/documentation/`

## Archival Policy

### When to Archive
- **Deployment Scripts:** When superseded by newer deployment methods
- **Server Files:** When no longer referenced by any active deployment
- **Backup Directories:** After 90 days (except most recent)
- **Documentation:** When information is outdated or consolidated elsewhere
- **Test Files:** After feature completion and production deployment

### When NOT to Archive
- Files actively used in production
- Current configuration files (.env, package.json)
- Active feature documentation
- Files referenced by CLAUDE.md or productionserver.md

## Restoration

### To Restore Archived Files
```bash
# Example: restore an old deployment script
cp archive/deployment-scripts/deploy_ai_gm_complete.sh .
chmod +x deploy_ai_gm_complete.sh
```

### To Find Archived Content
```bash
# Search archive for specific file
find archive/ -name "*search_term*"

# List all archived deployment scripts
ls -lh archive/deployment-scripts/

# Search archive contents
grep -r "search_term" archive/
```

## Archive History

### 2025-10-01 - Repository Cleanup
**Rationale:** Consolidate 16+ deployment scripts, clarify which files are active

**Archived:**
- `deploy_ai_gm_complete.sh` - Superseded by deploy_complete_features.sh
- `deploy_complete_localhost.sh` - Development only, not for production
- `deploy_wiki_*` scripts (5 files) - Now part of main deployment
- `deploy_relief_tilemap*` scripts (2 files) - Feature complete, integrated
- `direct_archive_fix.sh`, `direct_deploy.sh` - One-time fix scripts
- `migrate_production_data.sh` - Migration complete
- `sync_production_scp.sh` - Replaced by deploy scripts
- Test files: `test-*.html` - Moved to archive/test-scripts/
- Backup directories: `backup_2025_09_18/` - Moved to archive/backups/

**Kept Active:**
- `deploy_complete_features.sh` - Primary deployment script
- `deploy_image_generation.sh` - Specialized image feature deployment
- `production_restart.sh` - Quick restart without redeployment  
- `restart_iinou_server.sh` - Alternative restart method
- `DEPLOYMENT_WIKI_UI.sh` - Wiki-specific deployment

### Server Versions (Pre-2025-09)
**Archived in:** `archive/server-versions/`

All old server variations were consolidated into `server_sqlite_new.js`. Archived versions include:
- server.js, server_sqlite.js (original MySQL versions)
- server_sqlite_ai*.js (AI feature iterations)
- server_sqlite_*_backup*.js (timestamped backups)
- 26 historical server files total

### Deployment Scripts (Pre-2025-09)
**Archived in:** `archive/deployment-scripts/`

100+ old deployment scripts from iterative development. These represent:
- Feature-specific deployments (AI GM, profiles, dice rolls, archiving)
- SSL configuration iterations
- MySQL-to-SQLite migration scripts
- Quick fixes and patches
- Debug and diagnostic tools

All functionality is now consolidated into modern deployment scripts.

## File Size Summary
- **Total Archived:** ~2.5 MB of scripts and documentation
- **Root Directory Reduced:** From 150+ files to ~40 active files
- **Deployment Scripts:** From 100+ to 5 active scripts

## Notes
- Archived files are kept in version control for historical reference
- No functionality has been lost - all features are in current production version
- Archived files can be restored if needed for debugging or reference
- Future cleanup: Consider removing archives older than 2 years

---
**Last Updated:** 2025-10-01  
**Next Review:** 2025-12-01
