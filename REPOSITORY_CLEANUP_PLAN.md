# Repository Cleanup Plan

## Overview
The Eno-Frontend repository has accumulated many redundant scripts, old configuration files, and outdated server versions during development. This plan outlines a systematic cleanup to improve maintainability and reduce confusion.

## Current Issues
- 50+ deployment scripts with overlapping functionality
- Multiple server versions (server.js, server_sqlite.js variations)  
- Test scripts scattered throughout root directory
- Old backup files taking up space
- Configuration files for different environments mixed together

## Cleanup Strategy

### Phase 1: Create Archive Structure
```
archive/
├── deployment-scripts/     # Old deployment scripts
├── server-versions/        # Outdated server files
├── test-scripts/          # Development test files
├── config-files/          # Old configuration files
└── documentation/         # Outdated docs
```

### Phase 2: Files to Archive

#### Deployment Scripts (Keep only 2-3 current ones)
**Keep in Root:**
- `deploy_image_generation.sh` (current, working)
- `restart_iinou_server.sh` (simple restart)
- `sync_production_scp.sh` (file sync)

**Archive to `archive/deployment-scripts/`:**
- `deploy_ai_*.sh` (except current)
- `deploy_archiving_*.sh`
- `deploy_dice_*.sh` 
- `deploy_gm_*.sh`
- `deploy_mysql_*.sh`
- `deploy_phase_*.sh`
- `deploy_profile_*.sh`
- `deploy_sqlite_*.sh`
- `deploy_ssl_*.sh`
- `deploy_storyboard_*.sh`
- `deploy_to_production.sh` (outdated server config)
- `deploy_fixes.sh`
- All other deploy_*.sh files

#### Server Files (Keep only current)
**Keep in `js/`:**
- `server_sqlite_new.js` (current production server)
- `script.js` (frontend)
- `storyboard.js`, `threads.js` (current UI)
- `services/` directory (current services)

**Archive to `archive/server-versions/`:**
- `server.js` (MySQL version)
- `server_sqlite.js` (old SQLite version)
- `server_*.js` (all backup/variant versions)
- `server_original.js`
- `server_production.js`
- All `server_sqlite_*.backup.*` files
- `simple_*.js` servers
- `current_server.js`
- `debug_server.js`

#### Test Scripts
**Archive to `archive/test-scripts/`:**
- All `test_*.js` files
- All `test_*.html` files  
- All `test_*.sh` files
- `check_*.sh` scripts
- `debug_*.sh` scripts
- `diagnose_*.sh` scripts
- `verify_*.sh` scripts

#### Fix/Maintenance Scripts
**Archive to `archive/deployment-scripts/`:**
- All `fix_*.sh` files
- All `add_*.sh` files
- All `apply_*.sh` files
- `complete_*.sh`
- `correct_*.sh`
- `create_*.sh` (except essential ones)
- `ensure_*.sh`
- `final_*.sh`
- `force_*.sh`
- `improve_*.sh`
- `quick_*.sh`
- `simple_*.sh`
- `simpler_*.sh`
- `switch_*.sh`
- `update_*.sh`
- `upload_*.sh`

#### Configuration Files
**Keep in Root:**
- `package.json`, `package-lock.json`
- `.env.example`
- `.gitignore`

**Archive to `archive/config-files/`:**
- `cookies.txt`, `production_cookies.txt`
- `sftp_commands.txt`
- `mysql_schema.sql`, `mysql_schema_fixed.sql`
- Any old config files

#### Documentation
**Keep in Root:**
- `README.md`
- `CLAUDE.md`
- `KNOWN_ISSUES.md`
- `PROJECT_STATUS.md`
- `PLANNED_FEATURES.md`
- `productionserver.md`
- `testserver.md`

**Archive to `archive/documentation/`:**
- `AI_*.md` files (move to archive if outdated)
- `DEPLOYMENT_NOTES.md` (if superseded)
- `MYSQL_FIX_SUMMARY.md`
- `PROGRESS_REPORT_*.md`
- `SSL_RENEWAL_ISSUE.md` (if resolved)
- `TODAYS_SUMMARY.md`

### Phase 3: Files to Delete (After Backup)
- `.tar.gz` files in root
- `dice_roll_files_to_deploy.txt`
- Temporary files and logs
- Old backup files

### Phase 4: Clean Directory Structure

**Final Root Directory Structure:**
```
/root/Eno/Eno-Frontend/
├── archive/                    # Archived files
├── backups/                    # Keep current backups
├── css/                        # Current styles
├── data/                       # Database
├── hml/                        # Current HTML files
├── js/                         # Current JavaScript
│   ├── server_sqlite_new.js    # Production server
│   ├── script.js               # Frontend
│   ├── storyboard.js           # UI
│   ├── threads.js              # UI
│   └── services/               # Services
├── node_modules/               # Dependencies
├── portraits/                  # Character images
├── sql/                        # Current SQL schemas
├── style/                      # Reference images
├── deploy_image_generation.sh  # Current deployment
├── restart_iinou_server.sh     # Server restart
├── sync_production_scp.sh      # File sync
├── package.json                # Dependencies
├── README.md                   # Main documentation
├── CLAUDE.md                   # Development guide
├── KNOWN_ISSUES.md             # Current issues
├── PROJECT_STATUS.md           # Status
├── PLANNED_FEATURES.md         # Roadmap
├── productionserver.md         # Production guide
└── testserver.md               # Development guide
```

## Implementation Steps

### Step 1: Create Archive Structure
```bash
mkdir -p archive/{deployment-scripts,server-versions,test-scripts,config-files,documentation}
```

### Step 2: Move Deployment Scripts
```bash
mv deploy_ai_*.sh deploy_archiving_*.sh deploy_dice_*.sh deploy_gm_*.sh deploy_mysql_*.sh deploy_phase_*.sh deploy_profile_*.sh deploy_sqlite_*.sh deploy_ssl_*.sh deploy_storyboard_*.sh deploy_to_production.sh deploy_fixes.sh archive/deployment-scripts/
```

### Step 3: Move Old Server Files
```bash
mv js/server.js js/server_sqlite.js js/server_*.backup.* js/server_original.js js/server_production.js js/simple_*.js js/current_server.js js/debug_server.js archive/server-versions/
```

### Step 4: Move Test Scripts
```bash
mv test_*.* check_*.sh debug_*.sh diagnose_*.sh verify_*.sh archive/test-scripts/
```

### Step 5: Move Fix Scripts
```bash
mv fix_*.sh add_*.sh apply_*.sh complete_*.sh correct_*.sh ensure_*.sh final_*.sh force_*.sh improve_*.sh quick_*.sh simple_*.sh simpler_*.sh switch_*.sh update_*.sh upload_*.sh archive/deployment-scripts/
```

### Step 6: Update Documentation
- Update README.md with new structure
- Update deployment instructions to reference archived scripts
- Add note about archive location

## Benefits
- **Clarity:** Only current, working files in main directory
- **Maintenance:** Easier to identify what's actually in use
- **Deployment:** Clear which scripts to use for deployment
- **Development:** Reduced confusion for new contributors
- **History:** Old files preserved in archive for reference

## Rollback Plan
If any archived file is needed:
1. Check `archive/` directory for the file
2. Copy (don't move) back to root if still needed
3. Update this cleanup plan to mark as "keep"

## Timeline
- **Preparation:** 30 minutes (review and backup)
- **Execution:** 1 hour (create structure and move files)
- **Testing:** 30 minutes (verify deployments still work)
- **Documentation:** 30 minutes (update guides)

## Success Criteria
- [ ] Root directory has < 20 files
- [ ] Only current deployment scripts remain
- [ ] Only current server version in js/
- [ ] All essential functionality still works
- [ ] Documentation updated
- [ ] Archive structure created with all old files

---

**Created:** 2025-06-08  
**Status:** Plan Ready for Execution  
**Impact:** Low risk (files archived, not deleted)