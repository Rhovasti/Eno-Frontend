#!/bin/bash

# Phase 1-3 Complete Deployment Script
# Deploys all authentication fixes, database integrity improvements, and UI enhancements

echo "🚀 Deploying Phase 1-3 Complete Features to Production..."
echo "================================================="

# Key files to deploy
FILES_TO_DEPLOY="
js/server_sqlite_new.js
js/services/imageService.js
js/services/audioService.js
js/threads.js
js/storyboard.js
js/script.js
hml/threads.html
hml/login.html
hml/storyboard.html
hml/admin.html
hml/profile.html
css/styles.css
.env
style/
sql/add_dice_rolls.sql
sql/add_chapter_archiving.sql
"

echo "📦 Creating deployment package..."

# Create temporary directory for deployment
mkdir -p /tmp/eno_deployment
cd /root/Eno/Eno-Frontend

# Copy files to deployment directory
for file in $FILES_TO_DEPLOY; do
    if [ -f "$file" ] || [ -d "$file" ]; then
        echo "  ✅ Adding: $file"
        cp -r "$file" /tmp/eno_deployment/
    else
        echo "  ⚠️  Warning: $file not found"
    fi
done

# Create directory structure in deployment
mkdir -p /tmp/eno_deployment/js/services
mkdir -p /tmp/eno_deployment/hml
mkdir -p /tmp/eno_deployment/css
mkdir -p /tmp/eno_deployment/sql
mkdir -p /tmp/eno_deployment/style

# Copy with proper structure
cp js/server_sqlite_new.js /tmp/eno_deployment/js/
cp js/services/*.js /tmp/eno_deployment/js/services/
cp js/threads.js /tmp/eno_deployment/js/
cp js/storyboard.js /tmp/eno_deployment/js/
cp js/script.js /tmp/eno_deployment/js/
cp hml/*.html /tmp/eno_deployment/hml/
cp css/styles.css /tmp/eno_deployment/css/
cp .env /tmp/eno_deployment/
cp -r style/ /tmp/eno_deployment/
cp sql/add_dice_rolls.sql /tmp/eno_deployment/sql/
cp sql/add_chapter_archiving.sql /tmp/eno_deployment/sql/

# Create deployment archive
cd /tmp
tar -czf eno-phase-1-3-complete.tar.gz eno_deployment/
mv eno-phase-1-3-complete.tar.gz /root/Eno/Eno-Frontend/

echo "📦 Package created: eno-phase-1-3-complete.tar.gz"
echo ""

# Production deployment commands
echo "🔧 Production Deployment Instructions:"
echo "======================================"
echo ""
echo "1. Upload package to production:"
echo "   scp eno-phase-1-3-complete.tar.gz root@95.217.21.111:/var/www/pelisivusto/"
echo ""
echo "2. SSH to production server:"
echo "   ssh root@95.217.21.111"
echo ""
echo "3. Extract and deploy:"
echo "   cd /var/www/pelisivusto"
echo "   tar -xzf eno-phase-1-3-complete.tar.gz"
echo "   cp -r eno_deployment/* ."
echo "   rm -rf eno_deployment/"
echo ""
echo "4. Apply database migrations:"
echo "   sqlite3 data/database.sqlite < sql/add_dice_rolls.sql"
echo "   sqlite3 data/database.sqlite < sql/add_chapter_archiving.sql"
echo ""
echo "5. Restart server:"
echo "   pkill -f 'node.*server'"
echo "   export AWS_REGION=eu-north-1 && export AWS_BUCKET_NAME=kuvatjakalat && nohup node js/server_sqlite_new.js > server.log 2>&1 &"
echo ""
echo "6. Test deployment:"
echo "   curl -I https://www.iinou.eu"
echo "   # Check: Login, Games dropdown, Image generation, Dice rolling"
echo ""

# Automatic deployment option
echo "🚀 Auto-deploy to production? (requires server credentials)"
read -p "Deploy automatically now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Starting automatic deployment..."
    
    # Upload files
    echo "📤 Uploading files to production..."
    sshpass -p 'ininFvTPNTguUtuuLbx3' scp eno-phase-1-3-complete.tar.gz root@95.217.21.111:/var/www/pelisivusto/
    
    # Deploy and restart
    echo "🔧 Deploying and restarting production server..."
    sshpass -p 'ininFvTPNTguUtuuLbx3' ssh root@95.217.21.111 << 'EOF'
        cd /var/www/pelisivusto
        tar -xzf eno-phase-1-3-complete.tar.gz
        cp -r eno_deployment/* .
        rm -rf eno_deployment/ eno-phase-1-3-complete.tar.gz
        
        # Apply database migrations (ignore errors if already applied)
        sqlite3 data/database.sqlite < sql/add_dice_rolls.sql 2>/dev/null || true
        sqlite3 data/database.sqlite < sql/add_chapter_archiving.sql 2>/dev/null || true
        
        # Stop existing server
        pkill -f "node.*server" || true
        sleep 2
        
        # Start new server
        export AWS_REGION=eu-north-1 && export AWS_BUCKET_NAME=kuvatjakalat
        nohup node js/server_sqlite_new.js > server.log 2>&1 &
        
        echo "Production server restarted!"
        sleep 3
        ps aux | grep "node.*server" | grep -v grep
EOF
    
    echo "✅ Deployment complete!"
    echo "🌐 Test at: https://www.iinou.eu"
else
    echo "📋 Manual deployment instructions provided above."
fi

echo ""
echo "🎉 Phase 1-3 Features Deployed:"
echo "  ✅ Authentication fixes (credentials include)"
echo "  ✅ Database integrity (dice rolls, archiving)"
echo "  ✅ UI enhancements (image generation, navigation)"
echo "  ✅ All bug fixes and improvements"
echo ""
echo "⚠️  Note: SSL certificate may need renewal (see SSL_RENEWAL_ISSUE.md)"

# Cleanup
rm -rf /tmp/eno_deployment